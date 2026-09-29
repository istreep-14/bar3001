import { DASH, clockPlain, dayLabel, dec1, dollars, hours, yearTag } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import type { RateContext, ShiftView } from '../../lib/stats.ts';
import { openSheet } from '../../router.ts';
import { PartyIcon, SourceBadge, TypeIcon } from '../../ui/Badges.tsx';
import { RateFigure } from '../../ui/RateFigure.tsx';
import styles from './ShiftCard.module.css';

/** Card view of a shift. Fires the same openSheet as a table row; selection is an accent border. Its figures read like the
 *  desktop Log's: a shift still short of its money shows a dash, not a partial total, and the rate is judged against the
 *  listed shifts (`ctx`) on the same scale. Type and party are the same quiet icon badges the desktop Log and Table use
 *  for the same facts, not the full word pills (those are for places with no icon column of their own). */
export function ShiftCard({ v, ctx, selected }: { v: ShiftView; ctx: RateContext; selected: boolean }) {
  const { shift: s } = v, d = dayLabel(s.date), year = yearTag(s.date);
  const done = shiftStatus(v) === 'done';
  const time = s.start != null && s.end != null ? `${clockPlain(s.start)} – ${clockPlain(s.end)}` : '';
  const sources = [...new Set(v.income.map(i => i.category))];
  return (
    <li>
      <button class={styles.card} aria-current={selected ? 'true' : undefined} onClick={() => openSheet(s.id)}>
        <span class={styles.date} aria-hidden="true"><span class={styles.month}>{d.month}</span><span class={`${styles.day} num`}>{d.day}</span></span>
        <span class={styles.body}>
          <span class={styles.head}>
            <span class={styles.weekday}>{d.weekday}</span>
            {year && <span class={styles.year}>{year}</span>}
            <TypeIcon type={s.shift_type} />
            {s.party && <PartyIcon />}
            {s._dirty && <span class={`${styles.pending} tip`} data-tip="Not synced yet"><span class="sr-only">Not synced yet</span></span>}
          </span>
          <span class={`${styles.meta} num`}>{time || 'No times'}{v.hours != null && ` · ${hours(v.hours)}`}{v.crewCount > 0 && ` · ${v.crewCount} on the bar, ${dec1(v.crewHours)}h`}</span>
          {(s.notes || sources.length > 0) && (
            <span class={styles.foot}>
              {sources.map(c => <SourceBadge key={c} source={c} />)}
              {s.notes && <span class={styles.note}>{s.notes}</span>}
            </span>
          )}
        </span>
        <span class={styles.figures}>
          <span class={`${styles.total} num`}>{done ? dollars(v.total) : DASH}</span>
          {done && v.tph != null ? <RateFigure tph={v.tph} ctx={ctx} card /> : <span class={`muted ${styles.rateEmpty}`}>{DASH}</span>}
        </span>
      </button>
    </li>
  );
}
