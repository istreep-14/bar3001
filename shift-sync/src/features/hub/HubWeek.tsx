import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { hoursWorked, toHHMM, toMin } from '../../core/core.generated.js';
import { liveStaff, liveViews, removeCrewLine, saveCrewLine } from '../../data/store.ts';
import { addDays, today } from '../../lib/dates.ts';
import { clockShort, dec1, shortDate, weekdayShort } from '../../lib/format.ts';
import { crewWeek } from '../../lib/hub.ts';
import type { Cell } from '../../lib/hub.ts';
import { mondayOf } from '../../lib/periods.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { TypeIcon } from '../../ui/Badges.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { TimeField } from '../../ui/TimeField.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './Hub.module.css';

/* Crew week: every bartender as a row, Monday to Sunday across, each cell that person's hours on that day's shift.
 * Click a cell to set or change their start and end; hours are worked out from the times. A day with no shift can't hold hours,
 * so its cells are blank until the shift is logged. */
const monday = signal(mondayOf(today()));
const extra = signal<string[]>([]);
const editing = signal<{ view: ShiftView; staff_id: string; name: string } | null>(null);

export function HubWeek() {
  const people = liveStaff.value.map(p => ({ id: p.id, name: p.name, is_user: p.is_user }));
  const g = crewWeek(liveViews.value, monday.value, people, extra.value);
  const shown = new Set(g.rows.map(r => r.staff_id));
  const roster = liveStaff.value.filter(p => !shown.has(p.id) && p.status === 'active');
  const thisWeek = monday.value === mondayOf(today());
  return (
    <section class="panel" aria-labelledby="hw-title">
      <PanelHead title="Crew week" id="hw-title">
        <span class={styles.range} aria-live="polite">{shortDate(g.days[0]!)} – {shortDate(g.days[6]!)}</span>
        <div class={styles.nav}>
          {!thisWeek && <button type="button" class="linkbtn" onClick={() => { monday.value = mondayOf(today()); }}>This week</button>}
          <button type="button" class="icon-btn" aria-label="Previous week" onClick={() => { monday.value = addDays(monday.value, -7); }}><Icon name="left" /></button>
          <button type="button" class="icon-btn" aria-label="Next week" onClick={() => { monday.value = addDays(monday.value, 7); }}><Icon name="chevron" /></button>
        </div>
      </PanelHead>
      <div class="panel-body flush">
        <div class={styles.scroll}>
          <table class={`tbl ${styles.grid}`} aria-label="Crew hours this week">
            <thead>
              <tr>
                <th class="l" scope="col">Bartender</th>
                {g.days.map((d, i) => (
                  <th key={d} scope="col" class={d === today() ? styles.today : undefined}>
                    <span class={styles.dhead}>{weekdayShort(d)} <b>{+d.slice(8)}</b></span>
                    <span class={styles.dshift}>{g.shiftsPerDay[i]!.map(v => (
                      <span key={v.shift.id} title={`${v.shift.shift_type ?? 'Shift'} ${clockShort(v.shift.start)}–${clockShort(v.shift.end)}`}><TypeIcon type={v.shift.shift_type} /></span>
                    ))}</span>
                  </th>
                ))}
                <th scope="col">Hours</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map(r => (
                <tr key={r.staff_id}>
                  <th class="l strong" scope="row">{r.name}{liveStaff.value.find(p => p.id === r.staff_id)?.is_user && <span class={styles.you}>you</span>}</th>
                  {r.cells.map(c => <td key={c.date}><CellButtons cell={c} staff_id={r.staff_id} name={r.name} /></td>)}
                  <td class="strong">{r.hours ? dec1(r.hours) : '—'}</td>
                </tr>
              ))}
              {g.rows.length === 0 && <tr><td colSpan={9} class={styles.none}>No shifts logged this week. Log a shift, then set who worked it here.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <th class="l" scope="row">All bartenders</th>
                {g.dayHours.map((h, i) => <td key={i} class="mute">{h ? dec1(h) : '—'}</td>)}
                <td class="strong">{g.total ? dec1(g.total) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class={styles.addbar}>
          <label class={styles.add}>
            <span class="label-text">Add a bartender to this week</span>
            <select class="input" value="" onChange={e => { const id = e.currentTarget.value; if (id) extra.value = [...extra.value, id]; e.currentTarget.value = ''; }}>
              <option value="">Choose…</option>
              {roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </div>
      {editing.value && <HoursDialog key={editing.value.view.shift.id + editing.value.staff_id} />}
    </section>
  );
}

function CellButtons({ cell, staff_id, name }: { cell: Cell; staff_id: string; name: string }) {
  if (cell.shifts.length === 0) return <span class={styles.off} aria-hidden="true" />;
  return (
    <span class={styles.cell}>
      {cell.shifts.map(({ view, line }) => {
        const h = line ? hoursWorked(line.start, line.end) : null;
        return (
          <button type="button" key={view.shift.id} class={line ? styles.on : styles.empty} onClick={() => { editing.value = { view, staff_id, name }; }}
            aria-label={line ? `${name}, ${cell.date}: ${clockShort(line.start)} to ${clockShort(line.end)}. Edit` : `Add ${name} to the ${cell.date} shift`}>
            {line ? <><span class={styles.times}>{clockShort(line.start)}–{clockShort(line.end)}</span>{h != null && <b>{dec1(h)}h</b>}</> : <Icon name="plus" />}
          </button>
        );
      })}
    </span>
  );
}

function HoursDialog() {
  const e = editing.value!, sh = e.view.shift, line = e.view.crew.find(c => c.staff_id === e.staff_id) ?? null;
  const ref = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(toHHMM(line ? line.start : sh.start));
  const [end, setEnd] = useState(toHHMM(line ? line.end : sh.end));
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => { editing.value = null; };
  let s: number | null = null, en: number | null = null, bad = '';
  try { s = toMin(start); en = toMin(end); } catch (err) { bad = err instanceof Error ? err.message : 'Bad time'; }
  const h = bad ? null : hoursWorked(s, en);

  async function save(ev: Event) {
    ev.preventDefault();
    if (bad) return;
    try { await saveCrewLine({ shift_id: sh.id, staff_id: e.staff_id, id: line?.id, start: s, end: en }); close(); } catch (err) { toast(err instanceof Error ? err.message : 'Could not save'); }
  }
  async function remove() {
    if (!line) return;
    const gone = await removeCrewLine(line.id);
    close();
    if (gone) toast(`${e.name} removed from the shift`, { label: 'Undo', run: () => void saveCrewLine({ shift_id: gone.shift_id, staff_id: gone.staff_id, start: gone.start, end: gone.end }) });
  }
  return (
    <dialog ref={ref} class={styles.dialog} aria-labelledby="hd-title" onClose={close} onCancel={close} onClick={ev => { if (ev.target === ref.current) close(); }}>
      <form onSubmit={save} class={styles.dform}>
        <header><h2 id="hd-title">{e.name}</h2><p>{weekdayShort(sh.date)}, {shortDate(sh.date)} · shift {clockShort(sh.start)}–{clockShort(sh.end)}</p></header>
        <div class={styles.two}>
          <TimeField label="Start" value={start} onChange={setStart} />
          <TimeField label="End" value={end} pm={false} onChange={setEnd} />
        </div>
        <p class={styles.calc} aria-live="polite">{bad ? bad : h == null ? 'Enter both times to see the hours.' : `${dec1(h)} hours`}</p>
        <footer>
          {line && <button type="button" class="btn btn-quiet" onClick={() => void remove()}><Icon name="trash" /> Remove</button>}
          <span class={styles.spacer} />
          <button type="button" class="btn" onClick={close}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={!!bad}>Save</button>
        </footer>
      </form>
    </dialog>
  );
}
