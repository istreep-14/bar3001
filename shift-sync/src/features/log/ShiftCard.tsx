import { clockPlain, dayLabel, dec1, hours, money } from '../../lib/format.ts';
import { rateTone } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openSheet } from '../../router.ts';
import { PartyBadge, RatePill, SourceBadge, TypeBadge } from '../../ui/Badges.tsx';
import styles from './ShiftCard.module.css';

/** Card view of a shift. Fires the same openSheet as a table row; selection is an accent border. */
export function ShiftCard({ v, avg, selected }: { v: ShiftView; avg: number | null; selected: boolean }) {
  const { shift: s } = v, d = dayLabel(s.date), time = s.start != null && s.end != null ? `${clockPlain(s.start)} – ${clockPlain(s.end)}` : '';
  const sources = [...new Set(v.income.map(i => i.category))];
  return (
    <li>
      <button class={styles.card} aria-current={selected ? 'true' : undefined} onClick={() => openSheet(s.id)}>
        <span class={styles.date} aria-hidden="true"><span class={styles.month}>{d.month}</span><span class={`${styles.day} num`}>{d.day}</span></span>
        <span class={styles.body}>
          <span class={styles.head}>
            <span class={styles.weekday}>{d.weekday}</span>
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
          <span class={`${styles.total} num`}>{money(v.total)}</span>
          <RatePill tph={v.tph} tone={rateTone(v.tph, avg)} />
        </span>
      </button>
    </li>
  );
}
