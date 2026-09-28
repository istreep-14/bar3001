import { computed, signal } from '@preact/signals';
import { stripLocal, validateCrew, validateIncome, validateRow, validateStaff, validateWage } from '../core/core.generated.js';
import type { Category, Crew, Income, Local, Shift, Staff, Wage } from '../core/core.generated.js';
import { uid } from '../lib/id.ts';
import { planImport } from '../lib/bundle.ts';
import type { Bundle, Plan } from '../lib/bundle.ts';
import { byRecent, toView } from '../lib/stats.ts';
import type { ShiftView } from '../lib/stats.ts';
import { loadAll, putMany } from './db.ts';

/* In-memory mirror of IndexedDB. Components read signals; only the actions below write.
 * Every write is: update signal -> persist -> ask sync to run. */
export const shifts = signal<Record<string, Local<Shift>>>({});
export const incomeRows = signal<Record<string, Local<Income>>>({});
export const wageRows = signal<Record<string, Local<Wage>>>({});
export const crewRows = signal<Record<string, Local<Crew>>>({});
export const staffRows = signal<Record<string, Local<Staff>>>({});
export const ready = signal(false);

let onChange: () => void = () => {};
/** sync.ts registers itself here so the store doesn't import it (no cycle). */
export const setChangeHandler = (fn: () => void) => { onChange = fn; };

/** Hourly wage entries, oldest first. Each applies from its date until the next one's. */
export const liveWages = computed<Local<Wage>[]>(() =>
  Object.values(wageRows.value).filter(w => !w.deleted).sort((a, b) => a.date.localeCompare(b.date)));

export const liveViews = computed<ShiftView[]>(() => {
  const rates = liveWages.value;
  const byShift = new Map<string, Income[]>();
  for (const i of Object.values(incomeRows.value)) {
    if (i.deleted) continue;
    byShift.set(i.shift_id, [...(byShift.get(i.shift_id) ?? []), i]);
  }
  const crewBy = new Map<string, Crew[]>();
  for (const c of Object.values(crewRows.value)) {
    if (c.deleted) continue;
    crewBy.set(c.shift_id, [...(crewBy.get(c.shift_id) ?? []), c]);
  }
  return Object.values(shifts.value)
    .filter(s => !s.deleted)
    .map(s => toView(s, byShift.get(s.id) ?? [], (crewBy.get(s.id) ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')), rates))
    .sort(byRecent);
});

/** The roster, by name. */
export const liveStaff = computed<Local<Staff>[]>(() =>
  Object.values(staffRows.value).filter(p => !p.deleted).sort((a, b) => a.name.localeCompare(b.name)));
/* Lookups by id are kept as maps next to the lists, so a row or a card can ask for its person or shift without scanning. */
const staffIndex = computed(() => new Map(liveStaff.value.map(p => [p.id, p])));
export const personById = (id: string): Local<Staff> | undefined => staffIndex.value.get(id);
/** The roster's "this is me", if someone is marked. */
export const me = computed<Local<Staff> | undefined>(() => liveStaff.value.find(p => p.is_user));

export const pendingCount = computed(() =>
  [shifts.value, incomeRows.value, staffRows.value, crewRows.value, wageRows.value].reduce((n, m) => n + Object.values(m).filter(r => r._dirty).length, 0));

const viewIndex = computed(() => new Map(liveViews.value.map(v => [v.shift.id, v])));
export const viewById = (id: string): ShiftView | undefined => viewIndex.value.get(id);

export async function boot() {
  const [s, i, p, c, w] = await Promise.all([loadAll('rows'), loadAll('income'), loadAll('staff'), loadAll('crew'), loadAll('wages')]);
  wageRows.value = Object.fromEntries(w.map(r => [r.id, r]));
  crewRows.value = Object.fromEntries(c.map(r => [r.id, r]));
  shifts.value = Object.fromEntries(s.map(r => [r.id, r]));
  incomeRows.value = Object.fromEntries(i.map(r => [r.id, r]));
  staffRows.value = Object.fromEntries(p.map(r => [r.id, r]));
  ready.value = true;
}

export interface IncomeDraft { id?: string; category: Category; amount: number; note: string | null }
export interface CrewDraft { id?: string; staff_id: string; name: string | null; start: number | null; end: number | null }
export interface ShiftDraft extends Omit<Shift, 'id' | 'updated_at' | 'deleted' | 'other'> { id?: string }

/** Create or update a shift and reconcile its income lines in one write. */
export async function saveShift(draft: ShiftDraft, lines: IncomeDraft[], crew: CrewDraft[] = []): Promise<string> {
  const now = Date.now();
  const id = draft.id ?? uid();
  const prev = shifts.value[id];
  const seen = new Set<string>();
  for (const c of crew) {
    if (seen.has(c.staff_id)) throw new Error(`${c.name ?? 'Someone'} is on this shift twice.`);
    seen.add(c.staff_id);
  }
  const shift: Local<Shift> = { ...validateRow({ ...draft, id, other: prev?.other ?? null, updated_at: now, deleted: false }), _dirty: true };

  const keep = new Set(lines.map(l => l.id).filter(Boolean));
  const touched: Local<Income>[] = [];
  for (const old of Object.values(incomeRows.value)) {
    if (old.shift_id === id && !old.deleted && !keep.has(old.id)) touched.push({ ...old, deleted: true, updated_at: now, _dirty: true });
  }
  for (const l of lines) {
    touched.push({ ...validateIncome({ id: l.id ?? uid(), shift_id: id, category: l.category, amount: l.amount, note: l.note, updated_at: now, deleted: false }), _dirty: true });
  }

  /* Crew: a member keeps their row (by id) so a re-save is an edit, not a delete plus an add. */
  const keepCrew = new Set(crew.map(c => c.id).filter(Boolean));
  const crewTouched: Local<Crew>[] = [];
  for (const old of Object.values(crewRows.value)) {
    if (old.shift_id === id && !old.deleted && !keepCrew.has(old.id)) crewTouched.push({ ...old, deleted: true, updated_at: now, _dirty: true });
  }
  for (const c of crew) {
    crewTouched.push({ ...validateCrew({ id: c.id ?? uid(), shift_id: id, staff_id: c.staff_id, name: c.name, start: c.start, end: c.end, updated_at: now, deleted: false }), _dirty: true });
  }

  shifts.value = { ...shifts.value, [id]: shift };
  incomeRows.value = { ...incomeRows.value, ...Object.fromEntries(touched.map(r => [r.id, r])) };
  crewRows.value = { ...crewRows.value, ...Object.fromEntries(crewTouched.map(r => [r.id, r])) };
  await Promise.all([putMany('rows', [shift]), putMany('income', touched), putMany('crew', crewTouched)]);
  onChange();
  return id;
}

export interface Removed { shift: Shift; income: Income[]; crew: Crew[] }

/** Soft delete (the Sheet syncs it as deleted=TRUE). Returns what undoRemove needs. */
export async function removeShift(id: string): Promise<Removed | null> {
  const shift = shifts.value[id];
  if (!shift) return null;
  const now = Date.now();
  const lines = Object.values(incomeRows.value).filter(i => i.shift_id === id && !i.deleted);
  const crew = Object.values(crewRows.value).filter(c => c.shift_id === id && !c.deleted);
  const goneCrew = crew.map((c): Local<Crew> => ({ ...c, deleted: true, updated_at: now, _dirty: true }));
  const gone: Local<Shift> = { ...shift, deleted: true, updated_at: now, _dirty: true };
  const goneLines = lines.map((i): Local<Income> => ({ ...i, deleted: true, updated_at: now, _dirty: true }));
  shifts.value = { ...shifts.value, [id]: gone };
  incomeRows.value = { ...incomeRows.value, ...Object.fromEntries(goneLines.map(r => [r.id, r])) };
  crewRows.value = { ...crewRows.value, ...Object.fromEntries(goneCrew.map(r => [r.id, r])) };
  await Promise.all([putMany('rows', [gone]), putMany('income', goneLines), putMany('crew', goneCrew)]);
  onChange();
  return { shift: stripLocal(shift), income: lines.map(stripLocal), crew: crew.map(stripLocal) };
}

export async function undoRemove({ shift, income, crew }: Removed) {
  const now = Date.now();
  const back: Local<Shift> = { ...shift, deleted: false, updated_at: now, _dirty: true };
  const backLines = income.map((i): Local<Income> => ({ ...i, deleted: false, updated_at: now, _dirty: true }));
  shifts.value = { ...shifts.value, [back.id]: back };
  const backCrew = crew.map((c): Local<Crew> => ({ ...c, deleted: false, updated_at: now, _dirty: true }));
  incomeRows.value = { ...incomeRows.value, ...Object.fromEntries(backLines.map(r => [r.id, r])) };
  crewRows.value = { ...crewRows.value, ...Object.fromEntries(backCrew.map(r => [r.id, r])) };
  await Promise.all([putMany('rows', [back]), putMany('income', backLines), putMany('crew', backCrew)]);
  onChange();
}

/* ── Staff (the employee roster: identity only) ─────────────────────────────── */
export interface StaffDraft { id?: string; name: string; first: string | null; last: string | null; roles: string[]; id_number: string | null; manager: boolean; is_user: boolean; status: 'active' | 'inactive'; notes: string | null }

/** Create or update a person. The name is the roster's unique handle (case-insensitive). Only one person can be "me". */
export async function saveStaff(draft: StaffDraft): Promise<string> {
  const now = Date.now();
  const id = draft.id ?? uid();
  const name = draft.name.trim() || draft.first?.trim() || draft.last?.trim() || '';
  if (!name) throw new Error('Enter a name.');
  if (Object.values(staffRows.value).some(p => !p.deleted && p.id !== id && p.name.toLowerCase() === name.toLowerCase())) throw new Error(`"${name}" is already on the roster.`);
  const person: Local<Staff> = { ...validateStaff({ ...draft, id, name, updated_at: now, deleted: false }), _dirty: true };
  const touched: Local<Staff>[] = [person];
  if (person.is_user) for (const p of Object.values(staffRows.value)) if (p.id !== id && p.is_user && !p.deleted) touched.push({ ...p, is_user: false, updated_at: now, _dirty: true });
  staffRows.value = { ...staffRows.value, ...Object.fromEntries(touched.map(r => [r.id, r])) };
  await putMany('staff', touched);
  onChange();
  return id;
}

/** Soft delete; the Sheet gets deleted=TRUE. Returns what undoRemoveStaff needs. */
export async function removeStaff(id: string): Promise<Staff | null> {
  const p = staffRows.value[id];
  if (!p) return null;
  const gone: Local<Staff> = { ...p, deleted: true, updated_at: Date.now(), _dirty: true };
  staffRows.value = { ...staffRows.value, [id]: gone };
  await putMany('staff', [gone]);
  onChange();
  return stripLocal(p);
}

export async function undoRemoveStaff(p: Staff) {
  const back: Local<Staff> = { ...p, deleted: false, updated_at: Date.now(), _dirty: true };
  staffRows.value = { ...staffRows.value, [p.id]: back };
  await putMany('staff', [back]);
  onChange();
}

/* ── Hourly wage (your employer's rate, by the date it starts) ───────────────── */
export interface WageDraft { id?: string; date: string; rate: number; note?: string | null }

/** Create or update a wage entry. Two entries can't start on the same day: which would apply? */
export async function saveWage(draft: WageDraft): Promise<string> {
  const id = draft.id ?? uid();
  if (Object.values(wageRows.value).some(w => !w.deleted && w.id !== id && w.date === draft.date)) throw new Error('There is already a wage starting on that date.');
  const rec: Local<Wage> = { ...validateWage({ id, date: draft.date, rate: draft.rate, note: draft.note ?? null, updated_at: Date.now(), deleted: false }), _dirty: true };
  wageRows.value = { ...wageRows.value, [id]: rec };
  await putMany('wages', [rec]);
  onChange();
  return id;
}

export async function removeWage(id: string): Promise<Wage | null> {
  const w = wageRows.value[id];
  if (!w) return null;
  const gone: Local<Wage> = { ...w, deleted: true, updated_at: Date.now(), _dirty: true };
  wageRows.value = { ...wageRows.value, [id]: gone };
  await putMany('wages', [gone]);
  onChange();
  return stripLocal(w);
}

/* ── Import (a bundle from a migration script) ─────────────────────────────── */
/** Adds what isn't here yet, marked dirty so it syncs. Returns the plan so the caller can report it. */
export async function importBundle(b: Bundle): Promise<Plan> {
  const plan = planImport(b, {
    shiftIds: new Set(Object.keys(shifts.value)), incomeIds: new Set(Object.keys(incomeRows.value)),
    crewIds: new Set(Object.keys(crewRows.value)), staffIds: new Set(Object.keys(staffRows.value)),
    wageIds: new Set(Object.keys(wageRows.value)), wageDates: new Set(liveWages.value.map(w => w.date)),
    staff: Object.values(staffRows.value).filter(p => !p.deleted)
  }, Date.now());
  const dirty = <T extends object>(rs: T[]): Local<T>[] => rs.map(r => ({ ...r, _dirty: true }));
  const [s, i, p, c, w] = [dirty(plan.rows), dirty(plan.income), dirty(plan.staff), dirty(plan.crew), dirty(plan.wages)];
  wageRows.value = { ...wageRows.value, ...Object.fromEntries(w.map(r => [r.id, r])) };
  shifts.value = { ...shifts.value, ...Object.fromEntries(s.map(r => [r.id, r])) };
  incomeRows.value = { ...incomeRows.value, ...Object.fromEntries(i.map(r => [r.id, r])) };
  staffRows.value = { ...staffRows.value, ...Object.fromEntries(p.map(r => [r.id, r])) };
  crewRows.value = { ...crewRows.value, ...Object.fromEntries(c.map(r => [r.id, r])) };
  await Promise.all([putMany('rows', s), putMany('income', i), putMany('staff', p), putMany('crew', c), putMany('wages', w)]);
  if (s.length + p.length + w.length) onChange();
  return plan;
}

/* ── one-line edits, for the Hub tables (a person's hours on a shift, an income line) ── */
export interface CrewLine { id?: string; shift_id: string; staff_id: string; start: number | null; end: number | null }
/** Adds a bartender to a shift or changes their times. A person is on a shift once, so an existing row is edited, not duplicated. */
export async function saveCrewLine(l: CrewLine): Promise<string> {
  const now = Date.now();
  const existing = Object.values(crewRows.value).find(c => !c.deleted && c.shift_id === l.shift_id && (c.id === l.id || c.staff_id === l.staff_id));
  const row: Local<Crew> = { ...validateCrew({ id: existing?.id ?? l.id ?? uid(), shift_id: l.shift_id, staff_id: l.staff_id, name: personById(l.staff_id)?.name ?? existing?.name ?? null, start: l.start, end: l.end, updated_at: now, deleted: false }), _dirty: true };
  crewRows.value = { ...crewRows.value, [row.id]: row };
  await putMany('crew', [row]);
  onChange();
  return row.id;
}
export async function removeCrewLine(id: string): Promise<Crew | null> {
  const old = crewRows.value[id];
  if (!old || old.deleted) return null;
  const gone: Local<Crew> = { ...old, deleted: true, updated_at: Date.now(), _dirty: true };
  crewRows.value = { ...crewRows.value, [id]: gone };
  await putMany('crew', [gone]);
  onChange();
  return stripLocal(old);
}

export interface IncomeLine { id?: string; shift_id: string; category: Category; amount: number; note: string | null }
export async function saveIncomeLine(l: IncomeLine): Promise<string> {
  const row: Local<Income> = { ...validateIncome({ id: l.id ?? uid(), shift_id: l.shift_id, category: l.category, amount: l.amount, note: l.note, updated_at: Date.now(), deleted: false }), _dirty: true };
  incomeRows.value = { ...incomeRows.value, [row.id]: row };
  await putMany('income', [row]);
  onChange();
  return row.id;
}
export async function removeIncomeLine(id: string): Promise<Income | null> {
  const old = incomeRows.value[id];
  if (!old || old.deleted) return null;
  const gone: Local<Income> = { ...old, deleted: true, updated_at: Date.now(), _dirty: true };
  incomeRows.value = { ...incomeRows.value, [id]: gone };
  await putMany('income', [gone]);
  onChange();
  return stripLocal(old);
}
