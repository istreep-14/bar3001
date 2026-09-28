import { CATEGORIES, toMin } from '../../../core/core.generated.js';
import type { Category, ShiftType } from '../../../core/core.generated.js';

/* The shift form's model: its pages, the form object every page edits, and the check that runs before saving. Pure
 * (no store, no DOM), so it is tested on its own; ShiftForm.tsx holds the state and pages.tsx draws it. */

export type PageId = 'home' | 'date' | 'time' | 'type' | 'tips' | 'wage' | 'misc' | 'crew' | 'party' | 'notes';
export const GROUPS: { name: string; pages: { id: PageId; label: string }[] }[] = [
  { name: 'Shift', pages: [{ id: 'home', label: 'Overview' }] },
  { name: 'Info', pages: [{ id: 'date', label: 'Date' }, { id: 'time', label: 'Time' }, { id: 'type', label: 'Type' }] },
  { name: 'Income', pages: [{ id: 'tips', label: 'Tips' }, { id: 'wage', label: 'Wage' }, { id: 'misc', label: 'Other' }] },
  { name: 'Details', pages: [{ id: 'crew', label: 'Crew' }, { id: 'party', label: 'Party' }, { id: 'notes', label: 'Notes' }] }
];
export const ORDER = GROUPS.flatMap(g => g.pages.map(p => p.id));
export const LABEL = Object.fromEntries(GROUPS.flatMap(g => g.pages.map(p => [p.id, p.label]))) as Record<PageId, string>;

export interface Line { key: string; id?: string; category: Category; amount: string; note: string }
/** One bartender on the shift. `follow` = their times track the shift's own until they're edited by hand. */
export interface Member { key: string; id?: string; staff_id: string; name: string; start: string; end: string; follow: boolean }
/** Everything typed, as typed ('HH:MM' times, amounts as strings), so nothing is lost moving between pages. */
export interface Form { date: string; start: string; end: string; type: ShiftType | ''; party: boolean; tips: string; notes: string; lines: Line[]; crew: Member[] }
export type Errors = Record<string, string>;

let lineKey = 0, memberKey = 0;
export const newLine = (over: Partial<Line> = {}): Line => ({ key: 'l' + ++lineKey, category: CATEGORIES[0]!, amount: '', note: '', ...over });
export const newMember = (over: Pick<Member, 'staff_id' | 'name'> & Partial<Member>): Member => ({ key: 'm' + ++memberKey, start: '', end: '', follow: true, ...over });

/** '' is no value; anything else is a number (NaN when it isn't one, which check() reports). */
export const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));
/** 'HH:MM' to minutes, or null when blank or unreadable. */
export const minutes = (s: string): number | null => { try { return toMin(s); } catch { return null; } };
export const weekdayLong = (d: string): string => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });

export interface Checked {
  errors: Errors;
  start: number | null;
  end: number | null;
  tips: number | null;
  crew: { id?: string; staff_id: string; name: string; start: number | null; end: number | null }[];
}

/** Everything wrong with the form, keyed by field ('date', 'start', 'end', 'tips', 'line<key>', 'crew<key>'), plus the
 *  parsed values to save when there is nothing wrong. `nameOf` gives a bartender's current roster name. */
export function check(f: Form, nameOf: (staffId: string) => string | undefined = () => undefined): Checked {
  const errors: Errors = {};
  if (!f.date) errors.date = 'Pick a date.';
  let start: number | null = null, end: number | null = null;
  try { start = toMin(f.start); } catch { errors.start = 'Use a time like 6:00 PM.'; }
  try { end = toMin(f.end); } catch { errors.end = 'Use a time like 2:00 AM.'; }
  const tips = num(f.tips);
  if (tips != null && (isNaN(tips) || tips < 0)) errors.tips = 'Enter tips as a positive number.';
  for (const l of f.lines) if (l.amount.trim() === '' || isNaN(Number(l.amount))) errors['line' + l.key] = 'Enter an amount.';
  const crew = f.crew.map(m => {
    let s: number | null = null, e: number | null = null;
    try { s = toMin(m.start); } catch { errors['crew' + m.key] = `Use times like 6:00 PM for ${m.name}.`; }
    try { e = toMin(m.end); } catch { errors['crew' + m.key] = `Use times like 2:00 AM for ${m.name}.`; }
    return { id: m.id, staff_id: m.staff_id, name: nameOf(m.staff_id) ?? m.name, start: s, end: e };
  });
  return { errors, start, end, tips, crew };
}

const has = (errs: Errors, prefix: string) => Object.keys(errs).some(k => k.startsWith(prefix));
/** The page that holds each error, so its tab gets a dot. */
export function flaggedPages(errs: Errors): Set<PageId> {
  const out = new Set<PageId>();
  if (errs.date) out.add('date');
  if (errs.start || errs.end) out.add('time');
  if (errs.tips) out.add('tips');
  if (has(errs, 'line')) out.add('misc');
  if (has(errs, 'crew')) out.add('crew');
  return out;
}
/** The first page (in page order) with something to fix, or null. Save jumps there. */
export const pageOfError = (errs: Errors): PageId | null => ORDER.find(p => flaggedPages(errs).has(p)) ?? null;
