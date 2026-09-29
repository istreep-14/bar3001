import { DASH, clockPlain, dayLabel, dec1, hours, money, yearTag } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import type { RateContext, ShiftView } from '../../lib/stats.ts';
import { openSheet } from '../../router.ts';
import { PartyBadge, SourceBadge, TypeBadge } from '../../ui/Badges.tsx';
import { RateFigure } from '../../ui/RateFigure.tsx';
import styles from './ShiftCard.module.css';

/** Card view of a shift. Fires the same openSheet as a table row; selection is an accent border. Its figures read like the
 *  desktop Log's: a shift still short of its money shows a dash, not a partial total, and the rate is judged against the
 *  listed shifts (`ctx`) on the same scale. */
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
            <TypeBadge type={s.shift_type} />
            {s.party && <PartyBadge />}
            {s._dirty && <span class={styles.pending} title="Not synced yet"><span class="sr-only">Not synced yet</span></span>}
          </span>
          <span class={`${styles.meta} num`}>{time || 'No times'}{v.hours != null && ` · ${hours(v.hours)}`}{v.crewCount > 0 && ` · ${v.crewCount} on, ${dec1(v.crewHours)}h`}</span>
          {(s.notes || sources.length > 0) && (
            <span class={styles.foot}>
              {sources.map(c => <SourceBadge key={c} source={c} />)}
              {s.notes && <span class={styles.note}>{s.notes}</span>}
            </span>
          )}
        </span>
        <span class={styles.figures}>
          <span class={`${styles.total} num`}>{done ? money(v.total) : DASH}</span>
          {done && v.tph != null ? <RateFigure tph={v.tph} ctx={ctx} card /> : <span class="muted">{DASH}</span>}
        </span>
      </button>
    </li>
  );
}
