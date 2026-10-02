import type { ComponentChildren } from 'preact';
import { clockTight, dec1, fullDate, yearTag } from '../lib/format.ts';
import { dayBadge } from '../lib/groups.ts';
import type { ShiftView } from '../lib/stats.ts';
import { Icon } from '../ui/Icon.tsx';
import styles from './DayLine.module.css';

/** The one date cell. `stack` is the date, and under it the clock and a note glyph.
 *  `line` is the first line only, for a side-panel row. `showMonth` is false under a band that already names it.
 *  `tight` folds the hours onto the clock line (a phone). `sub` replaces line 2 (a pending pill, say).
 *  `lead` sets the date at the same size as the sheet's large figures. */
export function DayLine({ v, variant = 'stack', showMonth = true, showYear = false, tight = false, clock = true, lead = false, sub }: {
  v: ShiftView; variant?: 'stack' | 'line'; showMonth?: boolean; showYear?: boolean; tight?: boolean; clock?: boolean; lead?: boolean; sub?: ComponentChildren;
}) {
  const { month, day, weekday } = dayBadge(v.shift.date);
  const year = showYear ? yearTag(v.shift.date) : null;
  const type = v.shift.shift_type;
  const typeTip = type === 'day' ? 'Day shift' : type === 'night' ? 'Night shift' : '';
  const start = v.shift.start, end = v.shift.end;
  const times = start == null ? null : end == null ? `${clockTight(start)} start` : `${clockTight(start)} – ${clockTight(end)}`;
  const note = v.shift.notes?.trim() ?? '';
  const noteTip = note.length > 120 ? note.slice(0, 117) + '…' : note;
  const noteEl = noteTip ? (
    <span class={`${styles.note} tip`} data-tip={noteTip}>
      <Icon name="note" />
      <span class="sr-only">Note: {note}</span>
    </span>
  ) : null;
  return (
    <span class={`${styles.day} day${variant === 'line' ? ' ' + styles.line : ''}`} data-lead={lead ? '' : undefined} title={fullDate(v.shift.date)}>
      <span class={styles.top}>
        {type && (
          <span class={`${styles.mark} tip`} data-kind={type} data-tip={typeTip}>
            <Icon name={type === 'day' ? 'sun' : 'moon'} />
            <span class="sr-only">{typeTip}</span>
          </span>
        )}
        <span class={styles.wd}>{weekday}</span>
        {!showMonth && <span class="sr-only">{month} </span>}
        <span class={styles.date}>{showMonth ? `${month} ${day}` : day}</span>
        {year && <span class={styles.year}>{year}</span>}
        {v.shift.party && (
          <span class={`${styles.mark} tip`} data-kind="party" data-tip="Party">
            <Icon name="star" />
            <span class="sr-only">Party</span>
          </span>
        )}
        {!clock && noteEl}
      </span>
      {variant === 'stack' && (sub != null
        ? sub
        : clock && times && (
          <span class={styles.sub}>
            <Icon name="clock" />
            <span>{times}{tight && v.hours != null ? ` · ${dec1(v.hours)}h` : ''}</span>
            {noteEl}
          </span>
        ))}
    </span>
  );
}
