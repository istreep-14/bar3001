import { WEEKDAY_LETTERS } from '../lib/format.ts';
import styles from './WeekStrip.module.css';

/** Compact day picker: click a date to jump to it. Not a week pager — no prev/next. */
export function WeekStrip({ dates, selected, onSelect, label = 'Days' }: {
  dates: Iterable<string>;
  selected?: string | null;
  onSelect: (date: string) => void;
  label?: string;
}) {
  const days = [...new Set(dates)].sort();
  if (days.length === 0) return null;
  const weekday = (d: string) => {
    const i = new Date(d + 'T12:00:00').getDay();
    return WEEKDAY_LETTERS[(i + 6) % 7]!;   // Sunday=0 → last; Monday-first letters
  };
  return (
    <div class={styles.strip} role="group" aria-label={label}>
      <div class={styles.days}>
        {days.map(d => (
          <button type="button" key={d} class={styles.day} data-on={selected === d ? '' : undefined}
            aria-pressed={selected === d} aria-label={`${weekday(d)} ${+d.slice(8)}`}
            onClick={() => onSelect(d)}>
            <span class={styles.wd}>{weekday(d)}</span>
            <span class={`num ${styles.num}`}>{+d.slice(8)}</span>
            <i class={styles.dot} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
