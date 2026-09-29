import { addDays, weekStart } from './dates.ts';
import { isPending } from './groups.ts';
import { rankable, summarize } from './stats.ts';
import type { ShiftView, Summary } from './stats.ts';
import { inDates, pctChange } from './trends.ts';

/* What the Dashboard shows, worked out in one place. Weeks are the app's one week (Monday to Sunday, `WEEK_START`),
 * the same weeks the Log groups by, so a number here always matches a band there. Pure: pass today in. */

export interface Day { date: string; hours: number; tips: number; views: ShiftView[] }
export interface WeekCompare {
  start: string;
  /** This week is still running: `before` is last week up to the same weekday, so the change is like for like. */
  partial: boolean;
  now: Summary;
  before: Summary;
  /** Change against last week, per figure; null when last week had none of it. */
  delta: { tips: number | null; hours: number | null; tph: number | null; total: number | null; extra: number | null };
  /** Monday to Sunday, the week shown. */
  days: Day[];
}

/** `offset` 0 = this week, -1 = last week. A finished week is compared with the whole week before it; the running week
 *  only with the same days of last week (Monday to today's weekday), or Monday would always read as a big drop. */
export function weekCompare(views: ShiftView[], today: string, offset = 0): WeekCompare {
  const start = addDays(weekStart(today), offset * 7), end = addDays(start, 6);
  const partial = today >= start && today < end;
  const cut = partial ? today : end;
  const cur = inDates(views, start, cut), prev = inDates(views, addDays(start, -7), addDays(cut, -7));   // summarize drops pending shifts
  const now = summarize(cur), before = summarize(prev);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i), vs = views.filter(v => v.shift.date === date), counted = vs.filter(v => !isPending(v));
    return { date, views: vs, hours: counted.reduce((t, v) => t + (v.hours ?? 0), 0), tips: counted.reduce((t, v) => t + (v.shift.tips ?? 0), 0) };
  });
  return {
    start, partial, now, before, days,
    delta: {
      tips: pctChange(now.tips, before.tips), hours: pctChange(now.hours, before.hours), tph: pctChange(now.tph, before.tph),
      total: pctChange(now.total, before.total), extra: pctChange(now.extra, before.extra)
    }
  };
}

/** Your best shifts by tips per hour over the last `weeks` weeks, best first; only shifts long enough to rank (`rankable`). */
export const bestShifts = (views: ShiftView[], today: string, n = 4, weeks = 12): ShiftView[] => {
  const from = addDays(today, -weeks * 7);
  return views.filter(v => rankable(v) && v.shift.date >= from && v.shift.date <= today)
    .sort((a, b) => b.tph! - a.tph! || b.shift.date.localeCompare(a.shift.date)).slice(0, n);
};

/** Shifts still waiting on their money, oldest first: the ones to fill in. */
export const waiting = (views: ShiftView[]): ShiftView[] =>
  views.filter(isPending).sort((a, b) => a.shift.date.localeCompare(b.shift.date));
