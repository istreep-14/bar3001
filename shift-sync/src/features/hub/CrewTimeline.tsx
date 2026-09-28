import { liveStaff } from '../../data/store.ts';
import { today } from '../../lib/dates.ts';
import { clockPlain, dec1, weekdayShort } from '../../lib/format.ts';
import { place, rulerFor, tickLabel } from '../../lib/ruler.ts';
import type { ShiftView } from '../../lib/stats.ts';
import styles from './CrewTimeline.module.css';

/* Crew week as a timeline: the days down the side, one shared ruler across (noon to the small hours), and a bar per
 * bartender on each day's shift, so who overlapped with whom reads at a glance. Your bar is in the accent. Hours only,
 * never money per person. Clicking a bar edits that person's times (the same dialog as the grid). */
export function CrewTimeline({ days, shiftsPerDay, dayHours, onEdit }: {
  days: string[]; shiftsPerDay: ShiftView[][]; dayHours: number[];
  onEdit: (view: ShiftView, staff_id: string, name: string) => void;
}) {
  const all = shiftsPerDay.flat();
  const r = rulerFor(all.flatMap(v => [{ start: v.shift.start, end: v.shift.end }, ...v.crew.map(c => ({ start: c.start, end: c.end }))]));
  const t = today();
  return (
    <div class={styles.tl} role="table" aria-label="Crew times this week">
      <div class={`${styles.row} ${styles.headRow}`} role="row">
        <span role="columnheader" class={styles.head}>Day</span>
        <span role="columnheader" class={styles.ticks}>
          {r.ticks.map(m => <span key={m} class={styles.tick} style={{ left: `${((m - r.origin) / r.length) * 100}%` }}>{tickLabel(m)}</span>)}
        </span>
        <span role="columnheader" class={`${styles.head} r`}>Crew hours</span>
      </div>
      {days.map((d, i) => {
        const shifts = shiftsPerDay[i]!;
        return (
          <div class={styles.row} role="row" key={d} data-today={d === t ? '' : undefined}>
            <span role="rowheader" class={styles.day}><b>{weekdayShort(d)} {+d.slice(8)}</b>{d === t && <span class="chip" data-kind="accent">Today</span>}</span>
            <span role="cell" class={styles.lanes}>
              {shifts.length === 0 && <span class={styles.off}>Off</span>}
              {shifts.map(v => {
                const crew = [...v.crew].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
                if (!crew.length) {
                  const p = place(v.shift.start, v.shift.end, r);
                  return p && <span key={v.shift.id} class={styles.lane}><span class={`${styles.bar} ${styles.nobody}`} style={{ left: `${p.left}%`, width: `${p.width}%` }}>Nobody logged</span></span>;
                }
                return crew.map(c => {
                  const person = liveStaff.value.find(x => x.id === c.staff_id), name = person?.name ?? c.name ?? '?';
                  const p = place(c.start, c.end, r);
                  const label = `${name}${person?.is_user ? ' (you)' : ''}`;
                  return (
                    <span key={c.id} class={styles.lane}>
                      {p && (
                        <button type="button" class={styles.bar} data-you={person?.is_user ? '' : undefined} style={{ left: `${p.left}%`, width: `${p.width}%` }}
                          aria-label={`${label}, ${clockPlain(c.start)} to ${clockPlain(c.end)}. Edit`} title={`${label}: ${clockPlain(c.start)} – ${clockPlain(c.end)}`}
                          onClick={() => onEdit(v, c.staff_id, name)}>{label}</button>
                      )}
                    </span>
                  );
                });
              })}
            </span>
            <span role="cell" class={`${styles.hrs} r num`}>{dayHours[i] ? `${dec1(dayHours[i]!)}h` : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}
