import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { LOCATIONS, defaultShiftType, hoursWorked, toHHMM, toMin } from '../../core/core.generated.js';
import type { Location, ShiftType } from '../../core/core.generated.js';
import { liveStaff, liveViews, me, personById, removeCrewLine, removeShift, saveCrewLine, saveShift } from '../../data/store.ts';
import { addDays, today, weekStart } from '../../lib/dates.ts';
import { clockPlain, clockShort, dec1, shortDate, weekdayShort, weekLabel } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import { crewWeek } from '../../lib/hub.ts';
import type { Cell } from '../../lib/hub.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet } from '../../router.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { Page } from '../../ui/Page.tsx';
import { TimeField } from '../../ui/TimeField.tsx';
import { toast } from '../../ui/toast.tsx';
import h from './Hub.module.css';
import styles from './WeekPlan.module.css';

/* Plan the week: the schedule comes Monday to Sunday all at once, so it goes in here all at once. Days across the top,
 * each a small card: its shift (start time, day or night, a party) or a Book button for a day with none. Bartenders down
 * the side (you first), each cell their own times and station that day; a dashed + adds them to that day's shift, a
 * hatched cell is a day with no shift to add to. Hours add up along each row and down each day. Tips come later, on the
 * shift itself. */
const monday = signal(weekStart(today()));
/** People added to a week with no shift of theirs in it yet, by that week's Monday: added to this week, not every week. */
const extra = signal<Record<string, string[]>>({});
const editing = signal<{ view: ShiftView; staff_id: string; name: string } | null>(null);
const booking = signal<string | null>(null);

export function HubWeek() {
  const people = liveStaff.value.map(p => ({ id: p.id, name: p.name, is_user: p.is_user }));
  const added = extra.value[monday.value] ?? [];
  const g = crewWeek(liveViews.value, monday.value, people, added);
  const shown = new Set(g.rows.map(r => r.staff_id));
  const roster = liveStaff.value.filter(p => !shown.has(p.id) && p.status === 'active');
  const t = today(), thisWeek = monday.value === weekStart(t);
  const shiftN = g.shiftsPerDay.reduce((n, d) => n + d.length, 0);
  const lastWeek = liveViews.value.filter(v => v.shift.date >= addDays(monday.value, -7) && v.shift.date < monday.value);
  const step = (n: number) => { monday.value = addDays(monday.value, 7 * n); };
  // a phone shows a couple of days at a time: open on today when it's this week
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current, day = el?.querySelector<HTMLElement>('[data-when="today"]');
    if (el && day && el.scrollWidth > el.clientWidth) el.scrollLeft += day.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.querySelector<HTMLElement>('[role="columnheader"]')?.offsetWidth ?? 0) - 8;
  }, [monday.value]);

  return (
    <Page title="Plan the week" id="hw-title" fill quiet tools={
      <div class={styles.nav}>
        <button type="button" class={styles.step} aria-label="Previous week" onClick={() => step(-1)}><Icon name="left" /></button>
        <span class={styles.range} aria-live="polite"><b>{thisWeek ? 'This week' : monday.value === addDays(weekStart(t), 7) ? 'Next week' : weekLabel(monday.value)}</b><small>{weekLabel(monday.value)}</small></span>
        <button type="button" class={styles.step} aria-label="Next week" onClick={() => step(1)}><Icon name="chevron" /></button>
        {!thisWeek && <button type="button" class="linkbtn" onClick={() => { monday.value = weekStart(t); }}>This week</button>}
      </div>
    }>
      <div class={styles.body}>
        <p class={styles.sum}>
          {shiftN === 0 && lastWeek.length > 0 && (
            <button type="button" class="btn" onClick={() => void copyWeek(lastWeek)}><Icon name="refresh" />Book it like last week ({lastWeek.length} {lastWeek.length === 1 ? 'shift' : 'shifts'})</button>
          )}
          <b>{shiftN}</b> {shiftN === 1 ? 'shift' : 'shifts'} booked · <b>{g.rows.length}</b> {g.rows.length === 1 ? 'bartender' : 'bartenders'} · <b>{dec1(g.total)}h</b> between them
        </p>
        <div class={styles.scroll} ref={scroller}>
          <div class={styles.grid} role="table" aria-label={`The week of ${weekLabel(monday.value)}`}>
            <div class={styles.row} role="row">
              <span class={styles.corner} role="columnheader">Bartender</span>
              {g.days.map((d, i) => <DayHead key={d} date={d} shifts={g.shiftsPerDay[i]!} today={t} />)}
              <span class={styles.totHead} role="columnheader">Hours</span>
            </div>
            {g.rows.map(r => {
              const you = !!personById(r.staff_id)?.is_user;
              return (
                <div key={r.staff_id} class={styles.row} data-you={you ? '' : undefined} role="row">
                  <span class={styles.who} role="rowheader">
                    <PersonAvatar id={r.staff_id} fallback={r.name} size="sm" />
                    <span class={styles.name}>{r.name}</span>
                    {you && <MeBadge />}
                  </span>
                  {r.cells.map(c => <span key={c.date} class={styles.cell} role="cell"><CellButtons cell={c} staff_id={r.staff_id} name={r.name} today={t} /></span>)}
                  <span class={styles.tot} role="cell">{r.hours ? `${dec1(r.hours)}h` : ''}</span>
                </div>
              );
            })}
            {g.rows.length === 0 && <p class={styles.none}>Book a day above, then add who works it.</p>}
            <div class={styles.row} data-foot="" role="row">
              <span class={styles.who} role="rowheader">Everyone</span>
              {g.dayHours.map((x, i) => <span key={i} class={styles.tot} role="cell">{x ? `${dec1(x)}h` : ''}</span>)}
              <span class={styles.tot} role="cell"><b>{g.total ? `${dec1(g.total)}h` : ''}</b></span>
            </div>
          </div>
        </div>
        <label class={styles.add}>
          <Icon name="plus" />
          <select class="input" id="week-add-bartender" name="week-add-bartender" value="" aria-label="Add a bartender to this week"
            onChange={e => { const id = e.currentTarget.value; if (id) extra.value = { ...extra.value, [monday.value]: [...added, id] }; e.currentTarget.value = ''; }}>
            <option value="">Add a bartender to this week…</option>
            {roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {editing.value && <HoursDialog key={editing.value.view.shift.id + editing.value.staff_id} />}
      {booking.value && <BookDialog key={booking.value} date={booking.value} />}
    </Page>
  );
}

/** Books last week's shifts a week later: the same days, start times, day or night, party, and crew with their start
 *  times and stations (no ends, no tips; those come once it's worked). Undo removes them. */
async function copyWeek(views: ShiftView[]) {
  const ids: string[] = [];
  try {
    for (const v of views) {
      ids.push(await saveShift({ date: addDays(v.shift.date, 7), start: v.shift.start, end: null, tips: null, notes: null, shift_type: v.shift.shift_type, party: v.shift.party }, [],
        v.crew.map(c => ({ staff_id: c.staff_id, name: c.name, start: c.start, end: null, location: c.location }))));
    }
    toast(`${ids.length} ${ids.length === 1 ? 'shift' : 'shifts'} booked like last week`, { label: 'Undo', run: () => { for (const id of ids) void removeShift(id); } });
  } catch (err) { toast(err instanceof Error ? err.message : 'Could not book the week'); }
}

/* a day's head: weekday and date, then its shift(s), or a Book button */
function DayHead({ date, shifts, today: t }: { date: string; shifts: ShiftView[]; today: string }) {
  const when = date < t ? 'past' : date === t ? 'today' : 'ahead';
  return (
    <div class={styles.day} data-when={when} role="columnheader">
      <span class={styles.dayName}><span>{weekdayShort(date)}</span><b>{+date.slice(8)}</b></span>
      {shifts.map(v => {
        const st = shiftStatus(v);
        return (
          <button type="button" key={v.shift.id} class={styles.shift} data-status={st} onClick={() => (st === 'worked' ? openForm(v.shift.id) : openSheet(v.shift.id))}
            aria-label={`${weekdayShort(date)} ${shortDate(date)}: ${v.shift.shift_type ?? 'shift'} from ${clockPlain(v.shift.start) || 'a time not set'}${v.shift.party ? ', party' : ''}. Open`}>
            <Icon name={v.shift.shift_type === 'day' ? 'sun' : 'moon'} />
            <b>{clockShort(v.shift.start) || '—'}</b>
            {v.shift.party && <small>Party</small>}
          </button>
        );
      })}
      {shifts.length === 0 && (
        <button type="button" class={styles.book} onClick={() => { booking.value = date; }} aria-label={`Book ${weekdayShort(date)} ${shortDate(date)}`}>
          <Icon name="plus" />Book
        </button>
      )}
    </div>
  );
}

function CellButtons({ cell, staff_id, name, today: t }: { cell: Cell; staff_id: string; name: string; today: string }) {
  if (cell.shifts.length === 0) return <span class={styles.off} aria-label="No shift" />;
  return (
    <>
      {cell.shifts.map(({ view, line }) => {
        const hrs = line ? hoursWorked(line.start, line.end) : null;
        return line ? (
          <button type="button" key={view.shift.id} class={styles.slot} data-when={cell.date < t ? 'past' : cell.date === t ? 'today' : 'ahead'} onClick={() => { editing.value = { view, staff_id, name }; }}
            aria-label={`${name}, ${cell.date}: ${clockPlain(line.start)} to ${line.end != null ? clockPlain(line.end) : 'open'}${line.location ? `, ${line.location}` : ''}. Edit`}>
            <span class={styles.times}>{clockShort(line.start) || '—'}{line.end != null ? `–${clockShort(line.end)}` : ''}</span>
            <span class={styles.slotFoot}>{hrs != null ? <b>{dec1(hrs)}h</b> : <small>open</small>}{line.location && <i class={styles.station}>{line.location}</i>}</span>
          </button>
        ) : (
          <button type="button" key={view.shift.id} class={styles.empty} onClick={() => { editing.value = { view, staff_id, name }; }} aria-label={`Add ${name} to the ${cell.date} shift`}>
            <Icon name="plus" />
          </button>
        );
      })}
    </>
  );
}

function HoursDialog() {
  const e = editing.value!, sh = e.view.shift, line = e.view.crew.find(c => c.staff_id === e.staff_id) ?? null;
  const ref = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(toHHMM(line ? line.start : sh.start));
  const [end, setEnd] = useState(toHHMM(line ? line.end : sh.end));
  const [spot, setSpot] = useState<Location | ''>(line?.location ?? '');
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { editing.value = null; };
  let s: number | null = null, en: number | null = null, bad = '';
  try { s = toMin(start); en = toMin(end); } catch (err) { bad = err instanceof Error ? err.message : 'Bad time'; }
  const hrs = bad ? null : hoursWorked(s, en);

  async function save(ev: Event) {
    ev.preventDefault();
    if (bad) return;
    try { await saveCrewLine({ shift_id: sh.id, staff_id: e.staff_id, id: line?.id, start: s, end: en, location: spot || null }); close(); } catch (err) { toast(err instanceof Error ? err.message : 'Could not save'); }
  }
  async function remove() {
    if (!line) return;
    const gone = await removeCrewLine(line.id);
    close();
    if (gone) toast(`${e.name} removed from the shift`, { label: 'Undo', run: () => void saveCrewLine({ shift_id: gone.shift_id, staff_id: gone.staff_id, start: gone.start, end: gone.end, location: gone.location }) });
  }
  return (
    <dialog ref={ref} class={h.dialog} aria-labelledby="hd-title" onClose={close} onCancel={close} onClick={ev => { if (ev.target === ref.current) close(); }}>
      <form onSubmit={save} class={h.dform}>
        <header><h2 id="hd-title">{e.name}</h2><p>{weekdayShort(sh.date)}, {shortDate(sh.date)} · shift {clockPlain(sh.start)}{sh.end != null ? ` – ${clockPlain(sh.end)}` : ''}</p></header>
        <div class={h.two}>
          <TimeField label="Start" value={start} onChange={setStart} />
          <TimeField label="End" value={end} pm={false} onChange={setEnd} />
        </div>
        <Stations value={spot} onChange={setSpot} />
        <p class={h.calc} aria-live="polite">{bad ? bad : hrs == null ? 'Leave the end empty until you know it.' : `${dec1(hrs)} hours`}</p>
        <footer>
          {line && <button type="button" class="btn btn-quiet" onClick={() => void remove()}><Icon name="trash" /> Remove</button>}
          <span class={h.spacer} />
          <button type="button" class="btn" onClick={close}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={!!bad}>Save</button>
        </footer>
      </form>
    </dialog>
  );
}

function Stations({ value, onChange }: { value: Location | ''; onChange: (v: Location | '') => void }) {
  return (
    <fieldset class={styles.choices}>
      <legend class="label-text">Station</legend>
      {(['', ...LOCATIONS] as (Location | '')[]).map(l => (
        <button type="button" key={l || 'none'} role="radio" aria-checked={value === l} class={styles.choice} onClick={() => onChange(l)}>{l || 'Not set'}</button>
      ))}
    </fieldset>
  );
}

/* book a day: the start, day or night (guessed from the start until you pick), a party; you go on the crew */
function BookDialog({ date }: { date: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState('');
  const [type, setType] = useState<ShiftType | ''>('');
  const [picked, setPicked] = useState(false);
  const [party, setParty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { booking.value = null; };
  let s: number | null = null, bad = '';
  try { s = toMin(start); } catch (err) { bad = err instanceof Error ? err.message : 'Bad time'; }
  const you = me.value;

  async function save(ev: Event) {
    ev.preventDefault();
    if (bad || busy) return;
    setBusy(true);
    try {
      const id = await saveShift({ date, start: s, end: null, tips: null, notes: null, shift_type: type || null, party },
        [], you ? [{ staff_id: you.id, name: you.name, start: s, end: null, location: null }] : []);
      close();
      toast(`${weekdayShort(date)} ${shortDate(date)} booked`, { label: 'Open', run: () => openSheet(id) });
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not save'); setBusy(false); }
  }
  return (
    <dialog ref={ref} class={h.dialog} aria-labelledby="bk-title" onClose={close} onCancel={close} onClick={ev => { if (ev.target === ref.current) close(); }}>
      <form onSubmit={save} class={h.dform}>
        <header><h2 id="bk-title">Book {weekdayShort(date)}, {shortDate(date)}</h2><p>{you ? `You go on the crew; add the others in the grid.` : 'Add who works it in the grid.'}</p></header>
        <TimeField label="Start" value={start} onChange={v => { setStart(v); if (!picked) { try { setType(defaultShiftType(toMin(v)) ?? ''); } catch { /* typing */ } } }} />
        <fieldset class={styles.choices}>
          <legend class="label-text">Shift</legend>
          {(['day', 'night'] as ShiftType[]).map(x => (
            <button type="button" key={x} role="radio" aria-checked={type === x} class={styles.choice} onClick={() => { setType(x); setPicked(true); }}>
              <Icon name={x === 'day' ? 'sun' : 'moon'} />{x === 'day' ? 'Day' : 'Night'}
            </button>
          ))}
          <button type="button" role="checkbox" aria-checked={party} class={styles.choice} onClick={() => setParty(!party)}><Icon name="sparkle" />Party</button>
        </fieldset>
        {bad && <p class={h.calc}>{bad}</p>}
        <footer>
          <span class={h.spacer} />
          <button type="button" class="btn" onClick={close}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={!!bad || busy}>Book</button>
        </footer>
      </form>
    </dialog>
  );
}
