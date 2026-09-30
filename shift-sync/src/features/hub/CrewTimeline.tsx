import { hoursWorked } from '../../core/core.generated.js';
import { personById, roleByName } from '../../data/store.ts';
import { today } from '../../lib/dates.ts';
import { clockPlain, clockShort, dec1, weekdayShort } from '../../lib/format.ts';
import { rolesOf } from '../../lib/people.ts';
import { nightRuler, nowOnRuler, placeSpan, rulerFor, tickLabel } from '../../lib/ruler.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { avatarColor } from '../../ui/Avatar.tsx';
import { swatchColor } from '../../ui/swatches.ts';
import styles from './CrewTimeline.module.css';

/* Crew week as a timeline: days down the page, one shared hour ruler, a lane per bartender. The bar is the role's
 * colour (or their avatar colour) so overlap reads by hue. Hours only, never money. A click edits that person's times. */
export function CrewTimeline({ days, shiftsPerDay, dayHours, onEdit, compact }: {
  days: string[]; shiftsPerDay: ShiftView[][]; dayHours: number[];
  onEdit?: (view: ShiftView, staff_id: string, name: string) => void;
  compact?: boolean;
}) {
  const all = shiftsPerDay.flat();
  const spans = all.flatMap(v => [{ start: v.shift.start, end: v.shift.end }, ...v.crew.map(c => ({ start: c.start ?? v.shift.start, end: c.end ?? v.shift.end }))]);
  const r = compact ? nightRuler(spans) : rulerFor(spans);
  const t = today();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowPct = nowOnRuler(r, now);
  return (
    <div class={`${styles.tl} ${compact ? styles.compact : ''}`} role="table" aria-label={compact ? 'Hours this night' : 'Crew times this week'}>
      <div class={`${styles.row} ${styles.headRow}`} role="row">
        <span role="columnheader" class={styles.whoHead}>Who</span>
        <span role="columnheader" class={styles.ticks}>
          {r.ticks.map(m => <span key={m} class={styles.tick} style={{ left: `${((m - r.origin) / r.length) * 100}%` }}>{tickLabel(m)}</span>)}
        </span>
      </div>
      {days.map((d, i) => {
        const shifts = shiftsPerDay[i]!;
        const lanes = peopleOn(shifts);
        return (
          <div class={styles.block} role="rowgroup" key={d} data-today={d === t ? '' : undefined}>
            <div class={styles.dayHead}>
              {!compact && <b>{weekdayShort(d)} {+d.slice(8)}</b>}
              {d === t && <span class={styles.nowChip}><i />Now {clockShort(now.getHours() * 60 + now.getMinutes())}</span>}
              <span class={`${styles.dayHrs} num`}>{dayHours[i] ? `${dec1(dayHours[i]!)}h` : '—'}</span>
            </div>
            {lanes.length === 0 && (
              <div class={styles.person} role="row">
                <span class={styles.who} role="rowheader"><span class={styles.off}>Off</span></span>
                <span role="cell" class={styles.track}><Grid r={r} />{d === t && nowPct != null && <i class={styles.now} style={{ left: `${nowPct}%` }} />}</span>
              </div>
            )}
            {lanes.map(lane => {
              const p = placeSpan(lane.start, lane.end, r, nowMin);
              const color = barColor(lane.staff_id);
              const you = !!(lane.staff_id && personById(lane.staff_id)?.is_user);
              const label = `${lane.name}${you ? ' (you)' : ''}`;
              const h = hoursWorked(lane.start, lane.end);
              const when = lane.end != null ? `${clockShort(lane.start)} – ${clockShort(lane.end)}` : `${clockShort(lane.start)} – Open`;
              return (
                <div class={styles.person} role="row" key={lane.key}>
                  <span class={styles.who} role="rowheader">
                    {lane.staff_id ? <PersonAvatar id={lane.staff_id} fallback={lane.name} size="sm" /> : null}
                    <span class={styles.whoText}>
                      <span class={styles.name}>{lane.name}{you && <MeBadge />}</span>
                      {lane.role && <span class={styles.role}>{lane.role}</span>}
                    </span>
                  </span>
                  <span role="cell" class={styles.track}>
                    <Grid r={r} />
                    {d === t && nowPct != null && <i class={styles.now} style={{ left: `${nowPct}%` }} />}
                    {p && lane.staff_id && onEdit ? (
                      <button type="button" class={styles.bar} style={{ left: `${p.left}%`, width: `${p.width}%`, ['--bar']: color }}
                        aria-label={`${label}, ${clockPlain(lane.start)} to ${lane.end != null ? clockPlain(lane.end) : 'Open'}. Edit`}
                        title={`${label}: ${when}`}
                        onClick={e => { e.stopPropagation(); onEdit(lane.view, lane.staff_id!, lane.name); }}>
                        <span class={styles.when}>{when}</span>
                        {h != null && <span class={styles.len}>{dec1(h)}h</span>}
                      </button>
                    ) : p && lane.staff_id ? (
                      <span class={styles.bar} style={{ left: `${p.left}%`, width: `${p.width}%`, ['--bar']: color }}
                        title={`${label}: ${when}`}>
                        <span class={styles.when}>{when}</span>
                        {h != null && <span class={styles.len}>{dec1(h)}h</span>}
                      </span>
                    ) : p ? (
                      <span class={`${styles.bar} ${styles.nobody}`} style={{ left: `${p.left}%`, width: `${p.width}%` }}>Nobody logged</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Grid({ r }: { r: ReturnType<typeof rulerFor> }) {
  return (
    <span class={styles.grid} aria-hidden="true">
      {r.ticks.map(m => <i key={m} style={{ left: `${((m - r.origin) / r.length) * 100}%` }} />)}
    </span>
  );
}

function peopleOn(shifts: ShiftView[]) {
  const out: { key: string; view: ShiftView; staff_id: string | null; name: string; role: string | null; start: number | null; end: number | null }[] = [];
  for (const v of shifts) {
    const crew = [...v.crew].sort((a, b) => (a.start ?? 9999) - (b.start ?? 9999));
    if (!crew.length) out.push({ key: v.shift.id, view: v, staff_id: null, name: 'Nobody logged', role: null, start: v.shift.start, end: v.shift.end });
    for (const c of crew) {
      const person = personById(c.staff_id);
      out.push({
        key: c.id, view: v, staff_id: c.staff_id, name: person?.name ?? c.name ?? '?',
        role: person ? rolesOf(person).main : null, start: c.start ?? v.shift.start, end: c.end ?? v.shift.end
      });
    }
  }
  return out;
}

function barColor(id: string | null): string {
  if (!id) return 'var(--ink-3)';
  const person = personById(id);
  const main = person ? rolesOf(person).main : null;
  const role = main ? roleByName(main) : undefined;
  return swatchColor(role?.color)?.value ?? avatarColor(id, person?.avatar_color).value;
}
