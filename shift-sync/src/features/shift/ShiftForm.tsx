import { useEffect, useRef, useState } from 'preact/hooks';
import { CATEGORIES, defaultShiftType, hoursWorked, tipsPerHour, toHHMM, toMin, wageFor, wageRateFor } from '../../core/core.generated.js';
import type { Category, ShiftType } from '../../core/core.generated.js';
import { liveStaff, liveViews, liveWages, personById, ready, removeShift, saveShift, undoRemove, viewById } from '../../data/store.ts';
import { today, weekday } from '../../lib/dates.ts';
import { DASH, clockPlain, dec1, hours, longDate, money, moneyWhole, shortDate, weekdayShort } from '../../lib/format.ts';
import { partsOf } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import { closeDrawer, go, guard, sheetDate } from '../../router.ts';
import { Facts, Ribbon } from '../../ui/charts.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MixBar, MixKey } from '../../ui/MixBar.tsx';
import { MonthCalendar } from '../../ui/MonthCalendar.tsx';
import { TimeField } from '../../ui/TimeField.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './ShiftForm.module.css';

/* The shift form: add or edit one shift in a dialog over the page. It opens on Overview, which holds the three things
 * every shift needs (date on a calendar that already shows your shifts, start and end, tips) and what the shift adds up
 * to. The pages after it (Info: Date, Time, Type · Income: Tips, Wage, Other · Details: Crew, Party, Notes) each give one
 * part a full panel, with a live one-line summary and a dot when a field on it needs fixing. Every page's input lives in
 * one form object, so nothing typed is lost by moving between pages. */
type PageId = 'home' | 'date' | 'time' | 'type' | 'tips' | 'wage' | 'misc' | 'crew' | 'party' | 'notes';
const GROUPS: { name: string; pages: { id: PageId; label: string }[] }[] = [
  { name: 'Shift', pages: [{ id: 'home', label: 'Overview' }] },
  { name: 'Info', pages: [{ id: 'date', label: 'Date' }, { id: 'time', label: 'Time' }, { id: 'type', label: 'Type' }] },
  { name: 'Income', pages: [{ id: 'tips', label: 'Tips' }, { id: 'wage', label: 'Wage' }, { id: 'misc', label: 'Other' }] },
  { name: 'Details', pages: [{ id: 'crew', label: 'Crew' }, { id: 'party', label: 'Party' }, { id: 'notes', label: 'Notes' }] }
];
const ORDER = GROUPS.flatMap(g => g.pages.map(p => p.id));
const LABEL = Object.fromEntries(GROUPS.flatMap(g => g.pages.map(p => [p.id, p.label]))) as Record<PageId, string>;

interface Line { key: string; id?: string; category: Category; amount: string; note: string }
/** One bartender on the shift. `follow` = their times track the shift's own until they're edited by hand. */
interface Member { key: string; id?: string; staff_id: string; name: string; start: string; end: string; follow: boolean }
interface Form { date: string; start: string; end: string; type: ShiftType | ''; party: boolean; tips: string; notes: string; lines: Line[]; crew: Member[] }

let lineKey = 0, memberKey = 0;
const newLine = (over: Partial<Line> = {}): Line => ({ key: 'l' + ++lineKey, category: CATEGORIES[0]!, amount: '', note: '', ...over });
const newMember = (over: Pick<Member, 'staff_id' | 'name'> & Partial<Member>): Member => ({ key: 'm' + ++memberKey, start: '', end: '', follow: true, ...over });
const meOnRoster = () => liveStaff.value.find(p => p.is_user);
const weekdayLong = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
const num = (s: string) => (s.trim() === '' ? null : Number(s));
const minutes = (s: string): number | null => { try { return toMin(s); } catch { return null; } };

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
  const flagged = new Set<PageId>();
  if (errors.date) flagged.add('date');
  if (errors.start || errors.end) flagged.add('time');
  if (errors.tips) flagged.add('tips');
  if (Object.keys(errors).some(k => k.startsWith('line'))) flagged.add('misc');
  if (Object.keys(errors).some(k => k.startsWith('crew'))) flagged.add('crew');
  const pageOfError = (errs: Record<string, string>): PageId | null =>
    errs.date ? 'date' : errs.start || errs.end ? 'time' : errs.tips ? 'tips' : Object.keys(errs).some(k => k.startsWith('line')) ? 'misc' : Object.keys(errs).some(k => k.startsWith('crew')) ? 'crew' : null;

  async function submit(e: Event) {
    e.preventDefault();
    const f = form!, errs: Record<string, string> = {};
    if (!f.date) errs.date = 'Pick a date.';
    let s: number | null = null, en: number | null = null;
    try { s = toMin(f.start); } catch { errs.start = 'Use a time like 6:00 PM.'; }
    try { en = toMin(f.end); } catch { errs.end = 'Use a time like 2:00 AM.'; }
    const t = num(f.tips);
    if (t != null && (isNaN(t) || t < 0)) errs.tips = 'Enter tips as a positive number.';
    f.lines.forEach(l => { if (l.amount.trim() === '' || isNaN(Number(l.amount))) errs['line' + l.key] = 'Enter an amount.'; });
    const crew = f.crew.map(m => {
      let ms: number | null = null, me: number | null = null;
      try { ms = toMin(m.start); } catch { errs['crew' + m.key] = `Use times like 6:00 PM for ${m.name}.`; }
      try { me = toMin(m.end); } catch { errs['crew' + m.key] = `Use times like 2:00 AM for ${m.name}.`; }
      return { id: m.id, staff_id: m.staff_id, name: personById(m.staff_id)?.name ?? m.name, start: ms, end: me };
    });
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
  const timeFields = (
    <div class={styles.two}>
      <div class="field">
        <TimeField label="Start" value={form.start} invalid={!!errors.start}
          onChange={v => set({ start: v, ...(typeTouched.current ? {} : { type: defaultShiftType(minutes(v)) ?? '' }) })} />
        {err('start')}
      </div>
      <div class="field">
        <TimeField label="End" value={form.end} invalid={!!errors.end} pm={false} onChange={v => set({ end: v })} />
        {err('end')}
      </div>
    </div>
  );
  const tipsField = (
    <label class="field"><span class="label-text">Tips</span>
      <input class="input num" type="number" inputMode="decimal" step="0.01" min="0" value={form.tips} placeholder="0.00" aria-invalid={!!errors.tips} onInput={e => set({ tips: e.currentTarget.value })} />
      {err('tips')}
    </label>
  );

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
            {page === 'home' && (
              <div class={`${styles.pane} ${styles.home}`} role="tabpanel">
                <div class={styles.homeCal}>
                  <h3 class={styles.subhead}>Date{form.date && <span class={styles.homeSub}> · {longDate(form.date)}</span>}</h3>
                  <MonthCalendar mode="pick" views={liveViews.value} selected={form.date} exclude={isNew ? null : id} onPick={d => set({ date: d })} />
                  {sameDay.length > 0 && <p class={`${styles.datenote} ${styles.warn}`}>This day already has a shift. A second one is fine.</p>}
                  {err('date')}
                </div>
                <div class={styles.homeSide}>
                  <div class={styles.homeBlock}>
                    <h3 class={styles.subhead}>Time{h != null && <span class={styles.homeSub}> · {hours(h)}</span>}</h3>
                    {timeFields}
                    <button type="button" class="linkbtn" onClick={() => show('time')}>Compare with your past {form.date ? weekdayLong(form.date) : ''} shifts</button>
                  </div>
                  <div class={styles.homeBlock}>
                    <h3 class={styles.subhead}>Tips{tph != null && <span class={styles.homeSub}> · {money(tph)}/hr</span>}</h3>
                    {tipsField}
                    <button type="button" class="linkbtn" onClick={() => show('misc')}>Add other income</button>
                  </div>
                  <div class={styles.summary} aria-live="polite">
                    <span class="label">This shift adds up to</span>
                    <MixBar parts={parts} labels={false} />
                    <dl class={styles.sumList}>
                      {parts.map(p => <div key={p.key}><dt><MixKey token={p.token} />{p.label}{p.estimated && <small>estimated</small>}</dt><dd class="num">{money(p.amount)}</dd></div>)}
                      <div class={styles.sumTotal}><dt>Total</dt><dd class="num">{money(total)}</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {page === 'date' && (
              <div class={styles.pane} role="tabpanel">
                <div class={styles.dateline}>
                  <label class="field"><span class="label-text">Date</span>
                    <input class="input" type="date" value={form.date} aria-invalid={!!errors.date} required onInput={e => set({ date: e.currentTarget.value })} />
                  </label>
                  <p class={styles.datenote + (sameDay.length ? ' ' + styles.warn : '')}>
                    {form.date ? (sameDay.length ? `This day already holds ${sameDay.map(v => (v.shift.shift_type ? (v.shift.shift_type === 'day' ? 'a day' : 'a night') : 'a')).join(' and ')} shift. A second one is fine.` : longDate(form.date)) : 'Pick a day, or leave it blank for now.'}
                  </p>
                </div>
                {err('date')}
                <MonthCalendar mode="pick" views={liveViews.value} selected={form.date} exclude={isNew ? null : id} onPick={d => set({ date: d })} />
              </div>
            )}

            {page === 'time' && (
              <div class={styles.pane} role="tabpanel">
                {timeFields}
                <Facts items={[h != null && { label: 'Worked', value: hours(h) }, h != null && end != null && start != null && end <= start && { label: 'Ends', value: 'the next day' }]} />
                <Ribbon lanes={[{ name: 'This shift', start, end, cls: 'seg-work' }, ...pastSame.map(v => ({ name: `${weekdayShort(v.shift.date)} ${shortDate(v.shift.date)}`, start: v.shift.start, end: v.shift.end, cls: 'seg-past' as const }))]} />
                <p class={styles.hint}>{pastSame.length ? `Under it: your last ${pastSame.length === 1 ? '' : pastSame.length + ' '}${form.date ? weekdayLong(form.date) : ''} shift${pastSame.length === 1 ? '' : 's'}. ` : ''}An end at or before the start means the shift ends the next day.</p>
              </div>
            )}

            {page === 'type' && (
              <div class={styles.pane} role="tabpanel">
                <div class={styles.cards} role="radiogroup" aria-label="Shift type">
                  {(['day', 'night'] as const).map(t => {
                    const a = typeAvg(t);
                    return (
                      <label key={t} class={`${styles.card} k-${t}`}>
                        <input type="radio" name="type" value={t} checked={form.type === t}
                          onClick={() => { typeTouched.current = true; set({ type: form.type === t ? '' : t }); }} onChange={() => {}} />
                        <b>{t === 'day' ? 'Day' : 'Night'}</b>
                        <span class={styles.typehist}>{a.tph != null ? `${moneyWhole(a.tph)}/hr in tips over ${a.shifts} shift${a.shifts === 1 ? '' : 's'}` : 'No shifts of this type yet'}</span>
                      </label>
                    );
                  })}
                </div>
                <p class={styles.hint}>Starting at 3 PM or later fills in Night until you pick one yourself. Tap the chosen one again to clear it.</p>
              </div>
            )}

            {page === 'tips' && (
              <div class={styles.pane} role="tabpanel">
                {tipsField}
                <Facts items={[
                  tph != null && { label: 'Per hour', value: money(tph), note: avg != null ? `${moneyWhole(Math.abs(tph - avg))} ${tph >= avg ? 'above' : 'below'} your ${moneyWhole(avg)} average` : undefined, tone: avg == null ? undefined : tph >= avg ? 'up' : 'down' },
                  { label: 'Total income', value: money(total) }
                ]} />
              </div>
            )}

            {page === 'wage' && (
              <div class={styles.pane} role="tabpanel">
                <div class={styles.result} aria-live="polite">
                  {wageEst != null ? (
                    <>
                      <span class="label">Estimated wage</span>
                      <span class={styles.amt}>{money(wageEst)}</span>
                      <span class={styles.why}>{dec1(h)}h × ${wageRateFor(liveWages.value, form.date)}/hr, the hourly wage in effect on {form.date ? longDate(form.date) : 'that day'}</span>
                    </>
                  ) : (
                    <>
                      <span class="label">Estimated wage</span>
                      <span class={styles.why}>{h == null ? 'Enter the start and end times to estimate the wage.' : 'No hourly wage applies to this date.'}</span>
                    </>
                  )}
                </div>
                <p class={styles.hint}>Not typed: worked out from your hours and your hourly wage. <button type="button" class="linkbtn" onClick={() => go('settings/wages')}>Set your hourly wage</button></p>
                <Facts items={[{ label: 'Total income', value: money(total) }]} />
              </div>
            )}

            {page === 'misc' && (
              <div class={styles.pane} role="tabpanel">
                <div class={styles.rows}>
                  {form.lines.map((l, i) => (
                    <div class={styles.mrow} key={l.key} role="group" aria-label={`Other income ${i + 1}`}>
                      <label class="field"><span class="label-text">Source</span>
                        <select class="input" value={l.category} onChange={e => setLine(l.key, { category: e.currentTarget.value as Category })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                      </label>
                      <label class="field"><span class="label-text">Amount</span>
                        <input class="input num" type="number" inputMode="decimal" step="0.01" value={l.amount} placeholder="0.00" aria-invalid={!!errors['line' + l.key]} onInput={e => setLine(l.key, { amount: e.currentTarget.value })} />
                      </label>
                      <button type="button" class="btn btn-quiet btn-icon" aria-label={`Remove other income ${i + 1}`} onClick={() => setForm(f => f && { ...f, lines: f.lines.filter(x => x.key !== l.key) })}><Icon name="trash" /></button>
                      <label class={`field ${styles.note}`}><span class="label-text">Note</span>
                        <input class="input" type="text" value={l.note} onInput={e => setLine(l.key, { note: e.currentTarget.value })} />
                      </label>
                      {errors['line' + l.key] && <span class={`error ${styles.note}`}>{errors['line' + l.key]}</span>}
                    </div>
                  ))}
                </div>
                {legacy ? <p class={styles.hint}>Earlier entry: {money(legacy)} other income. It still counts toward the total.</p> : null}
                <div><button type="button" class="btn" onClick={() => setForm(f => f && { ...f, lines: [...f.lines, newLine()] })}><Icon name="plus" /> Add other income</button></div>
                <Facts items={[{ label: 'Other income', value: money(lineSum + legacy) }, { label: 'Total income', value: money(total) }]} />
              </div>
            )}

            {page === 'crew' && (
              <div class={styles.pane} role="tabpanel">
                <h3 class="label">Who worked</h3>
                {roster.length === 0 ? <p class={styles.hint}>Your roster is empty. Add people (and mark yourself) on the <a href="#/people">People</a> page.</p> : (
                  <div class={styles.pills}>
                    {roster.map(p => <button type="button" key={p.id} class={styles.pill} aria-pressed={inCrew.has(p.id)} onClick={() => (inCrew.has(p.id) ? setForm(f => f && { ...f, crew: f.crew.filter(m => m.staff_id !== p.id) }) : addMember(p.id))}>{p.name}{p.is_user ? ' (you)' : ''}</button>)}
                  </div>
                )}
                {roster.length > 0 && !meOnRoster() && <p class={styles.hint}>Mark one person as "This is me" on the People page to add yourself in one tap.</p>}
                <h3 class="label">Their shift</h3>
                {form.crew.length === 0 ? <p class={styles.hint}>No one else is on this shift. Tap a name above to add them.</p> : (
                  <div class={styles.rows}>
                    {form.crew.map(m => (
                      <div class={styles.person} key={m.key} role="group" aria-label={m.name}>
                        <div class={styles.pname}><span>{m.name}</span>{personById(m.staff_id)?.is_user && <small>you</small>}{memberHours(m) != null && <small class="num">{dec1(memberHours(m))}h</small>}</div>
                        <TimeField label="Start" value={m.start} invalid={!!errors['crew' + m.key]} onChange={v => setMember(m.key, { start: v, follow: false })} />
                        <TimeField label="End" value={m.end} invalid={!!errors['crew' + m.key]} pm={false} onChange={v => setMember(m.key, { end: v, follow: false })} />
                        <button type="button" class="btn btn-quiet btn-icon" aria-label={`Remove ${m.name}`} onClick={() => setForm(f => f && { ...f, crew: f.crew.filter(x => x.key !== m.key) })}><Icon name="trash" /></button>
                        {errors['crew' + m.key] && <span class="error">{errors['crew' + m.key]}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <Ribbon lanes={[{ name: 'Shift', start, end, cls: 'seg-work' }, ...form.crew.map(m => ({ name: m.name, start: minutes(m.start), end: minutes(m.end), cls: 'seg-crew' as const }))]} />
                <Facts items={form.crew.length ? [{ label: 'On the shift', value: `${form.crew.length}` }, { label: 'Hours, all', value: hours(form.crew.reduce((t, m) => t + (memberHours(m) ?? 0), 0)) }] : []} />
              </div>
            )}

            {page === 'party' && (
              <div class={styles.pane} role="tabpanel">
                <label class={styles.check}>
                  <input type="checkbox" checked={form.party} onChange={e => set({ party: e.currentTarget.checked })} />
                  <span><b>A party happened during this shift</b><span class={styles.hint}>The yes or no is what you compare shifts by. Put who and how many in the notes.</span></span>
                </label>
              </div>
            )}

            {page === 'notes' && (
              <div class={styles.pane} role="tabpanel">
                <label class="field"><span class="label-text">Notes</span>
                  <textarea class="input" rows={6} value={form.notes} onInput={e => set({ notes: e.currentTarget.value })} />
                </label>
              </div>
            )}
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
