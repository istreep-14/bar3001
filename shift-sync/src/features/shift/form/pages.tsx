import type { MutableRef } from 'preact/hooks';
import { CATEGORIES, defaultShiftType, wageRateFor } from '../../../core/core.generated.js';
import type { Category, ShiftType, Local, Staff } from '../../../core/core.generated.js';
import { liveViews, liveWages, me, personById } from '../../../data/store.ts';
import { dec1, hours, longDate, money, perHour, shortDate, weekdayShort } from '../../../lib/format.ts';
import type { IncomePart } from '../../../lib/groups.ts';
import type { ShiftView, Summary } from '../../../lib/stats.ts';
import { go } from '../../../router.ts';
import { Facts, Ribbon } from '../../../ui/charts.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { MeBadge } from '../../../ui/MeBadge.tsx';
import { MixBar, MixKey } from '../../../ui/MixBar.tsx';
import { MonthCalendar } from '../../../ui/MonthCalendar.tsx';
import { TimeField } from '../../../ui/TimeField.tsx';
import { minutes, newLine, weekdayLong } from './model.ts';
import type { Errors, Form, Line, Member, PageId } from './model.ts';
import styles from '../ShiftForm.module.css';

/* The shift form's pages, one component each. They draw from one context (the form, its setters, and the figures
   ShiftForm works out) and hold no state of their own, so moving between pages never loses anything typed. */
export interface Ctx {
  form: Form;
  set: (patch: Partial<Form>) => void;
  setForm: (fn: (f: Form | null) => Form | null) => void;
  setLine: (key: string, patch: Partial<Line>) => void;
  setMember: (key: string, patch: Partial<Member>) => void;
  addMember: (staffId: string) => void;
  errors: Errors;
  err: (key: string) => preact.JSX.Element | '' | undefined;
  show: (p: PageId) => void;
  isNew: boolean;
  id: string;
  typeTouched: MutableRef<boolean>;
  start: number | null; end: number | null; h: number | null;
  tipsNum: number | null; tph: number | null; avg: number | null; total: number;
  lineSum: number; legacy: number; wageEst: number | null; parts: IncomePart[];
  sameDay: ShiftView[]; pastSame: ShiftView[];
  typeAvg: (t: ShiftType) => Summary;
  memberHours: (m: Member) => number | null;
  inCrew: Set<string>;
  roster: Local<Staff>[];
}

/** You, if the roster marks someone as you: added to a new shift's crew, and offered first on the Crew page. */
export const meOnRoster = () => me.value;

/** Start and end, on Overview and on the Time page. Picking a start fills in Day or Night until you choose one. */
function TimeFields({ c }: { c: Ctx }) {
  const { form, set, errors, err, typeTouched } = c;
  return (
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
}

/** Tips, on Overview (under its own heading, so the label is for screen readers only) and on the Tips page. */
function TipsField({ c, hideLabel = false }: { c: Ctx; hideLabel?: boolean }) {
  const { form, set, errors, err } = c;
  return (
    <label class="field"><span class={hideLabel ? 'sr-only' : 'label-text'}>Tips</span>
      <input class="input num" type="number" inputMode="decimal" step="0.01" min="0" value={form.tips} placeholder="0.00" aria-invalid={!!errors.tips} onInput={e => set({ tips: e.currentTarget.value })} />
      {err('tips')}
    </label>
  );
}

export function HomePage({ c }: { c: Ctx }) {
  const { form, set, err, show, isNew, id, h, tph, total, parts, sameDay } = c;
  return (
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
          <TimeFields c={c} />
          <button type="button" class="linkbtn" onClick={() => show('time')}>{form.date ? `Compare with your past ${weekdayLong(form.date)} shifts` : 'Compare with your past shifts'}</button>
        </div>
        <div class={styles.homeBlock}>
          <h3 class={styles.subhead}>Tips{tph != null && <span class={styles.homeSub}> · {perHour(tph)}</span>}</h3>
          <TipsField c={c} hideLabel />
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
  );
}

export function DatePage({ c }: { c: Ctx }) {
  const { form, set, errors, err, isNew, id, sameDay } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <div class={styles.dateline}>
        <label class="field"><span class="label-text">Date</span>
          <input class="input" type="date" value={form.date} aria-invalid={!!errors.date} required onInput={e => set({ date: e.currentTarget.value })} />
        </label>
        <p class={styles.datenote + (sameDay.length ? ' ' + styles.warn : '')}>
          {form.date ? (sameDay.length ? `This day already holds ${sameDay.map(v => (v.shift.shift_type ? (v.shift.shift_type === 'day' ? 'a day' : 'a night') : 'a')).join(' and ')} shift. A second one is fine.` : longDate(form.date)) : 'Pick a day.'}
        </p>
      </div>
      {err('date')}
      <MonthCalendar mode="pick" views={liveViews.value} selected={form.date} exclude={isNew ? null : id} onPick={d => set({ date: d })} />
    </div>
  );
}

export function TimePage({ c }: { c: Ctx }) {
  const { form, start, end, h, pastSame } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <TimeFields c={c} />
      <Facts items={[h != null && { label: 'Worked', value: hours(h) }, h != null && end != null && start != null && end <= start && { label: 'Ends', value: 'the next day' }]} />
      <Ribbon lanes={[{ name: 'This shift', start, end, cls: 'seg-work' }, ...pastSame.map(v => ({ name: `${weekdayShort(v.shift.date)} ${shortDate(v.shift.date)}`, start: v.shift.start, end: v.shift.end, cls: 'seg-past' as const }))]} />
      <p class={styles.hint}>{pastSame.length ? `Under it: your last ${pastSame.length === 1 ? '' : pastSame.length + ' '}${form.date ? weekdayLong(form.date) : ''} shift${pastSame.length === 1 ? '' : 's'}. ` : ''}An end at or before the start means the shift ends the next day.</p>
    </div>
  );
}

export function TypePage({ c }: { c: Ctx }) {
  const { form, set, typeTouched, typeAvg } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <div class={styles.cards} role="radiogroup" aria-label="Shift type">
        {(['day', 'night'] as const).map(t => {
          const a = typeAvg(t);
          return (
            <label key={t} class={`${styles.card} k-${t}`}>
              <input type="radio" name="type" value={t} checked={form.type === t}
                onClick={() => { typeTouched.current = true; set({ type: form.type === t ? '' : t }); }} onChange={() => {}} />
              <b>{t === 'day' ? 'Day' : 'Night'}</b>
              <span class={styles.typehist}>{a.tph != null ? `${perHour(a.tph)} in tips over ${a.shifts} shift${a.shifts === 1 ? '' : 's'}` : 'No shifts of this type yet'}</span>
            </label>
          );
        })}
      </div>
      <p class={styles.hint}>Starting at 3 PM or later fills in Night until you pick one yourself. Tap the chosen one again to clear it.</p>
    </div>
  );
}

export function TipsPage({ c }: { c: Ctx }) {
  const { tph, avg, total } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <TipsField c={c} />
      <Facts items={[
        tph != null && { label: 'Per hour', value: money(tph), note: avg != null ? `${perHour(Math.abs(tph - avg))} ${tph >= avg ? 'above' : 'below'} your ${perHour(avg)} average` : undefined, tone: avg == null ? undefined : tph >= avg ? 'up' : 'down' },
        { label: 'Total income', value: money(total) }
      ]} />
    </div>
  );
}

export function WagePage({ c }: { c: Ctx }) {
  const { form, h, total, wageEst } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <div class={styles.result} aria-live="polite">
        {wageEst != null ? (
          <>
            <span class="label">Estimated wage</span>
            <span class={styles.amt}>{money(wageEst)}</span>
            <span class={styles.why}>{dec1(h)}h × {perHour(wageRateFor(liveWages.value, form.date))}, the hourly wage in effect on {form.date ? longDate(form.date) : 'that day'}</span>
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
  );
}

export function OtherPage({ c }: { c: Ctx }) {
  const { form, setForm, setLine, errors, total, lineSum, legacy } = c;
  return (
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
  );
}

export function CrewPage({ c }: { c: Ctx }) {
  const { form, setForm, setMember, addMember, errors, start, end, memberHours, inCrew, roster } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <h3 class="label">Who worked</h3>
      {roster.length === 0 ? <p class={styles.hint}>Your roster is empty. Add people (and mark yourself) on the <a href="#/people" onClick={e => { e.preventDefault(); go('people'); }}>People</a> page.</p> : (
        <div class={styles.pills}>
          {roster.map(p => <button type="button" key={p.id} class={styles.pill} aria-pressed={inCrew.has(p.id)} onClick={() => (inCrew.has(p.id) ? setForm(f => f && { ...f, crew: f.crew.filter(m => m.staff_id !== p.id) }) : addMember(p.id))}>{p.name}{p.is_user && <MeBadge />}</button>)}
        </div>
      )}
      {roster.length > 0 && !meOnRoster() && <p class={styles.hint}>Mark one person as "This is me" on the People page to add yourself in one tap.</p>}
      <h3 class="label">Their shift</h3>
      {form.crew.length === 0 ? <p class={styles.hint}>No one else is on this shift. Tap a name above to add them.</p> : (
        <div class={styles.rows}>
          {form.crew.map(m => (
            <div class={styles.person} key={m.key} role="group" aria-label={m.name}>
              <div class={styles.pname}><span>{m.name}</span>{personById(m.staff_id)?.is_user && <MeBadge />}{memberHours(m) != null && <small class="num">{dec1(memberHours(m))}h</small>}</div>
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
  );
}

export function PartyPage({ c }: { c: Ctx }) {
  const { form, set } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <label class={styles.check}>
        <input type="checkbox" checked={form.party} onChange={e => set({ party: e.currentTarget.checked })} />
        <span><b>A party happened during this shift</b><span class={styles.hint}>The yes or no is what you compare shifts by. Put who and how many in the notes.</span></span>
      </label>
    </div>
  );
}

export function NotesPage({ c }: { c: Ctx }) {
  const { form, set } = c;
  return (
    <div class={styles.pane} role="tabpanel">
      <label class="field"><span class="label-text">Notes</span>
        <textarea class="input" rows={6} value={form.notes} onInput={e => set({ notes: e.currentTarget.value })} />
      </label>
    </div>
  );
}

/** Each page, by id. */
export const PAGES: Record<PageId, (p: { c: Ctx }) => preact.JSX.Element> = {
  home: HomePage,
  date: DatePage,
  time: TimePage,
  type: TypePage,
  tips: TipsPage,
  wage: WagePage,
  misc: OtherPage,
  crew: CrewPage,
  party: PartyPage,
  notes: NotesPage
};
