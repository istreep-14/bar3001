import { DASH, clockTight, dollars, hours } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import type { RateContext, ShiftView } from '../../lib/stats.ts';
import { openSheet } from '../../router.ts';
import { SourceBadge } from '../../ui/Badges.tsx';
import { DayCell } from '../../ui/DayCell.tsx';
import { RateFigure } from '../../ui/RateFigure.tsx';
import styles from './ShiftCard.module.css';

/** One shift on a phone, the same one line as the sheet: the date, the time, then the total and the rate.
 *  A note or another income source takes a second line, because those are not their own columns here. */
export function ShiftCard({ v, ctx, selected }: { v: ShiftView; ctx: RateContext; selected: boolean }) {
  const { shift: s } = v;
  const done = shiftStatus(v) === 'done';
  const time = s.start != null && s.end != null ? `${clockTight(s.start)}–${clockTight(s.end)}` : '';
  const sources = [...new Set(v.income.map(i => i.category))];
  return (
    <li>
      <button class={styles.card} aria-current={selected ? 'true' : undefined} onClick={() => openSheet(s.id)}>
        <span class={styles.line}>
          <DayCell date={s.date} type={s.shift_type} party={s.party} />
          <span class={styles.time}>{time || 'No times'}</span>
          {v.hours != null && <span class={styles.quiet}>{hours(v.hours)}</span>}
          {s._dirty && <span class={`${styles.pending} tip`} data-tip="Not synced yet"><span class="sr-only">Not synced yet</span></span>}
        </span>
        <span class={styles.figures}>
          <span class={`${styles.total} num`}>{done ? dollars(v.total) : DASH}</span>
          {done && v.tph != null ? <RateFigure tph={v.tph} ctx={ctx} card /> : <span class={`muted ${styles.rateEmpty}`}>{DASH}</span>}
        </span>
        {(s.notes || sources.length > 0) && (
          <span class={styles.foot}>
            {sources.map(c => <SourceBadge key={c} source={c} />)}
            {s.notes && <span class={styles.note}>{s.notes}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
