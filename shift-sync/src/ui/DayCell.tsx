import type { ComponentChildren } from 'preact';
import { yearTag } from '../lib/format.ts';
import { dayBadge } from '../lib/groups.ts';
import { PartyIcon } from './Badges.tsx';
import { Icon } from './Icon.tsx';
import styles from './DayCell.module.css';

/** The day a row is about, on one line: the weekday (a quiet label), the date (the one bold value), the year only when it
 *  isn't this one, then the day/night mark and a party icon. Other income and Crew use it as their first column.
 *  With `chip`, it leads with a small calendar-page chip (the month in its colour over the day number) that anchors the row
 *  the way an avatar anchors a person, and `sub` gives it a second line (the Log puts the shift's times there). */
export function DayCell({ date, type, party, chip, sub }: { date: string; type?: 'day' | 'night' | null; party?: boolean; chip?: boolean; sub?: ComponentChildren }) {
  const { month, day, weekday } = dayBadge(date);
  const year = yearTag(date);
  const line = (
    <span class={styles.date}>
      <span class={styles.weekday}>{weekday}</span>
      <span class={`${styles.main} num`}>{month} {day}</span>
      {year && <span class={styles.year}>{year}</span>}
      {type && <span class={styles.type} data-kind={type}><Icon name={type === 'day' ? 'sun' : 'moon'} label={type === 'day' ? 'Day shift' : 'Night shift'} /></span>}
      {party && <PartyIcon />}
    </span>
  );
  if (!chip) return line;
  return (
    <span class={styles.withChip}>
      <CalendarChip date={date} />
      <span class={styles.lines}>{line}{sub && <span class={styles.sub}>{sub}</span>}</span>
    </span>
  );
}

/** A tiny calendar page: the month on a band in its own colour (one hue per calendar month), the day number under it. */
export function CalendarChip({ date }: { date: string }) {
  const { month, day, monthIndex } = dayBadge(date);
  return (
    <span class={styles.chip} style={{ '--mc': `var(--month-${monthIndex + 1})` }} aria-hidden="true">
      <span class={styles.chipMonth}>{month}</span><span class={`${styles.chipDay} num`}>{day}</span>
    </span>
  );
}
