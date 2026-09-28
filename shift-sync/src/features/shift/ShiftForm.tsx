import { useEffect, useRef, useState } from 'preact/hooks';
import { defaultShiftType, hoursWorked, tipsPerHour, toHHMM, wageFor } from '../../core/core.generated.js';
import type { ShiftType } from '../../core/core.generated.js';
import { liveStaff, liveViews, liveWages, personById, ready, removeShift, saveShift, undoRemove, viewById } from '../../data/store.ts';
import { today, weekday } from '../../lib/dates.ts';
import { clockPlain, money, moneyWhole, shortDate, weekdayShort } from '../../lib/format.ts';
import { partsOf } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import { closeDrawer, guard, sheetDate } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import { GROUPS, LABEL, ORDER, check, flaggedPages, minutes, newLine, newMember, num, pageOfError } from './form/model.ts';
import type { Form, Line, Member, PageId } from './form/model.ts';
import { PAGES, meOnRoster } from './form/pages.tsx';
import type { Ctx } from './form/pages.tsx';
import styles from './ShiftForm.module.css';

/* The shift form: add or edit one shift in a dialog over the page. It opens on Overview, which holds the three things
 * every shift needs (date on a calendar that already shows your shifts, start and end, tips) and what the shift adds up
 * to. The pages after it (Info: Date, Time, Type · Income: Tips, Wage, Other · Details: Crew, Party, Notes) each give one
 * part a full panel, with a live one-line summary and a dot when a field on it needs fixing. Every page's input lives in
 * one form object, so nothing typed is lost by moving between pages.
 *   form/model.ts   the pages, the form object, and check() (validation), pure and tested
 *   form/pages.tsx  one component per page, drawn from one context
 *   this file       state, the figures the pages show, save and delete, and the dialog around them */
function initial(id: string): Form | null {
  if (id === 'new') {
    const me = meOnRoster();   // you worked it, so you start on the crew
    return { date: sheetDate.value ?? today(), start: '', end: '', type: '', party: false, tips: '', notes: '', lines: [], crew: me ? [newMember({ staff_id: me.id, name: me.name })] : [] };
  }
  const v = viewById(id);
  if (!v) return null;
  const s = v.shift;
  return {
    date: s.date, start: toHHMM(s.start), end: toHHMM(s.end),
    type: s.shift_type ?? defaultShiftType(s.start) ?? '', party: !!s.party,
    tips: s.tips == null ? '' : String(s.tips), notes: s.notes ?? '',
    lines: v.income.map(i => newLine({ id: i.id, category: i.category, amount: String(i.amount), note: i.note ?? '' })),
    crew: v.crew.map(c => newMember({ id: c.id, staff_id: c.staff_id, name: personById(c.staff_id)?.name ?? c.name ?? 'Unknown', start: toHHMM(c.start), end: toHHMM(c.end), follow: false }))
  };
}

export function ShiftForm({ id }: { id: string }) {
  const isNew = id === 'new';
  const dlg = useRef<HTMLDialogElement>(null);
  const panes = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Form | null>(() => (ready.value ? initial(id) : null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState<PageId>('home');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);     // Close turned into "Discard changes?" for a moment
  const baseline = useRef(JSON.stringify(form));
  const typeTouched = useRef(!isNew);
  const dirty = form !== null && JSON.stringify(form) !== baseline.current;

  useEffect(() => { if (!form) closeDrawer(); }, [form]);
  useEffect(() => { dlg.current?.showModal(); }, []);
  useEffect(() => { guard.dirty = dirty; return () => { guard.dirty = false; }; }, [dirty]);
  useEffect(() => { if (closing) { const t = setTimeout(() => setClosing(false), 4000); return () => clearTimeout(t); } }, [closing]);
  if (!form) return null;

  const existing = isNew ? undefined : viewById(id);
  const set = (patch: Partial<Form>) => setForm(f => {
    if (!f) return f;
    const n = { ...f, ...patch };
    if ('start' in patch || 'end' in patch) n.crew = n.crew.map(c => (c.follow ? { ...c, start: n.start, end: n.end } : c));
    return n;
  });
  const setLine = (key: string, patch: Partial<Line>) => setForm(f => f && { ...f, lines: f.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) });
  const setMember = (key: string, patch: Partial<Member>) => setForm(f => f && { ...f, crew: f.crew.map(c => (c.key === key ? { ...c, ...patch } : c)) });
  const addMember = (staffId: string) => {
    const p = personById(staffId);
    if (p) setForm(f => f && { ...f, crew: [...f.crew, newMember({ staff_id: p.id, name: p.name, start: f.start, end: f.end })] });
  };
  const finish = () => { baseline.current = JSON.stringify(form); guard.dirty = false; closeDrawer(); };
  const requestClose = () => { if (dirty && !closing) return setClosing(true); finish(); };
  const show = (p: PageId) => { setPage(p); panes.current?.scrollTo({ top: 0 }); };
  const step = (by: number) => {
    const next = ORDER[ORDER.indexOf(page) + by];
    if (!next) return;
    show(next);
    queueMicrotask(() => panes.current?.querySelector<HTMLElement>('input:not([type="radio"]):not([type="checkbox"]), textarea, select, button.day.sel')?.focus({ preventScroll: true }));
  };

  // What the shift comes to, worked out with the same functions the Log uses.
  const start = minutes(form.start), end = minutes(form.end);
  const h = hoursWorked(start, end);
  const tips = num(form.tips);
  const tipsNum = tips != null && !isNaN(tips) ? tips : null;
  const lineSum = form.lines.reduce((t, l) => t + (Number(l.amount) || 0), 0);
  const legacy = existing?.shift.other ?? 0;
  const wageEst = wageFor(liveWages.value, form.date, h);
  const total = (tipsNum ?? 0) + lineSum + legacy + (wageEst ?? 0);
  const tph = tipsNum != null ? tipsPerHour({ start, end, tips: tipsNum }) : null;
  const others = liveViews.value.filter(v => v.shift.id !== id);
  const avg = summarize(others).tph;
  const typeAvg = (t: ShiftType) => summarize(others.filter(v => v.shift.shift_type === t));
  const memberHours = (m: Member) => hoursWorked(minutes(m.start), minutes(m.end));
  const inCrew = new Set(form.crew.map(m => m.staff_id));
  const roster = [...liveStaff.value].filter(p => p.status === 'active' || inCrew.has(p.id)).sort((a, b) => Number(b.is_user) - Number(a.is_user) || a.name.localeCompare(b.name));
  const sameDay = others.filter(v => v.shift.date === form.date);
  const parts = partsOf(tipsNum, wageEst, form.lines.map(l => ({ category: l.category, amount: Number(l.amount) || 0 })), legacy || null);
  // The last few shifts on the same weekday, drawn under this one on the Time page instead of offering presets.
  const pastSame = form.date ? others.filter(v => v.shift.date < form.date && weekday(v.shift.date) === weekday(form.date) && v.shift.start != null && v.shift.end != null).slice(0, 4) : [];

  const summaries: Record<PageId, string> = {
    home: `${form.date ? `${weekdayShort(form.date)} ${shortDate(form.date)}` : 'No date'} · ${moneyWhole(total)}`,
    date: form.date ? `${weekdayShort(form.date)}, ${shortDate(form.date)}` : 'Not set',
    time: start != null && end != null ? `${clockPlain(start)} – ${clockPlain(end)}` : 'Not set',
    type: form.type ? (form.type === 'day' ? 'Day' : 'Night') : 'Not set',
    tips: tipsNum != null ? moneyWhole(tipsNum) : 'None',
    wage: wageEst != null ? moneyWhole(wageEst) : 'No rate set',
    misc: form.lines.length || legacy ? `${form.lines.length + (legacy ? 1 : 0)} · ${moneyWhole(lineSum + legacy)}` : 'None',
    crew: form.crew.length ? `${form.crew.length} ${form.crew.length === 1 ? 'person' : 'people'}` : 'Just you',
    party: form.party ? 'Party' : 'No party',
    notes: form.notes.trim() ? form.notes.trim().slice(0, 18) : 'None'
  };
  const flagged = flaggedPages(errors);

  async function submit(e: Event) {
    e.preventDefault();
    const f = form!, { errors: errs, start: s, end: en, tips: t, crew } = check(f, sid => personById(sid)?.name);
    setErrors(errs);
    const first = pageOfError(errs);
    if (first) { show(first); return; }
    setSaving(true);
    try {
      await saveShift(
        { id: isNew ? undefined : id, date: f.date, start: s, end: en, tips: t, notes: f.notes.trim() || null, shift_type: f.type || null, party: f.party },
        f.lines.map(l => ({ id: l.id, category: l.category, amount: Number(l.amount), note: l.note.trim() || null })),
        crew
      );
      toast(isNew ? 'Shift added' : 'Shift saved');
      finish();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save.' });
      setSaving(false);
    }
  }

  /** Deletes at once; the toast's Undo is the safety net, so there is no second click to arm. */
  async function remove() {
    const gone = await removeShift(id);
    finish();
    if (gone) toast('Shift deleted', { label: 'Undo', run: () => void undoRemove(gone) });
  }

  const typeLabel = form.type ? (form.type === 'day' ? 'Day' : 'Night') : null;
  const meta = [form.date ? `${weekdayShort(form.date)}, ${shortDate(form.date)}` : null, typeLabel, `${money(total)} total`].filter(Boolean).join(' · ');
  const err = (k: string) => errors[k] && <span class="error">{errors[k]}</span>;
  const ctx: Ctx = {
    form, set, setForm, setLine, setMember, addMember, errors, err, show, isNew, id, typeTouched,
    start, end, h, tipsNum, tph, avg, total, lineSum, legacy, wageEst, parts, sameDay, pastSame, typeAvg, memberHours, inCrew, roster
  };
  const Page = PAGES[page];

  return (
    <dialog ref={dlg} class={styles.modal} aria-labelledby="form-title" onCancel={e => { e.preventDefault(); requestClose(); }}>
      <form class={styles.form} onSubmit={submit} noValidate>
        <header class={styles.head}>
          <div class={styles.crumbs}>
            <button type="button" class="linkbtn" onClick={requestClose}>Shifts</button><span aria-hidden="true">›</span>
            <b id="form-title">{isNew ? 'New shift' : 'Edit shift'}</b><span aria-hidden="true">›</span>
            <span class={styles.page} aria-live="polite">{LABEL[page]}</span>
          </div>
          <span class={styles.meta}>{meta}</span>
          <button type="button" class={closing ? 'btn btn-danger' : 'btn'} onClick={requestClose}>{closing ? 'Discard changes?' : 'Close'}</button>
        </header>
        {errors.form && <p class={styles.error} role="alert">{errors.form}</p>}

        <div class={styles.body}>
          <nav class={styles.steps} aria-label="Shift pages">
            {GROUPS.map(g => (
              <div class={styles.group} key={g.name} role="group" aria-label={g.name}>
                <h3 class={`${styles.gname} label`}>{g.name}</h3>
                {g.pages.map(p => (
                  <button type="button" key={p.id} class={styles.tab} role="tab" aria-selected={page === p.id} data-flag={flagged.has(p.id) ? '' : undefined} onClick={() => show(p.id)}>
                    <span class={styles.tabname}>{p.label}</span><span class={styles.tabsum}>{summaries[p.id]}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div class={styles.panes} ref={panes}>
            <Page c={ctx} />
          </div>
        </div>

        <footer class={styles.foot}>
          {!isNew && <button type="button" class="btn btn-danger" onClick={() => void remove()}>Delete</button>}
          <span class={styles.spacer} />
          <button type="button" class="btn" disabled={page === ORDER[0]} onClick={() => step(-1)}><Icon name="left" /> Back</button>
          <button type="button" class="btn" disabled={page === ORDER.at(-1)} onClick={() => step(1)}>Next <Icon name="chevron" /></button>
          <button type="submit" class="btn btn-primary" disabled={saving}>Save shift</button>
        </footer>
      </form>
    </dialog>
  );
}
