import { addDays, daysBetween, parts, ymd, weekStart } from './dates.ts';
import { WEEKDAY_NAMES } from './format.ts';
import { weekdayIndex } from './periods.ts';
import { addMonths } from './scope.ts';
import { summarize } from './stats.ts';
import type { ShiftView } from './stats.ts';

/* What the Overview reads as trends: this week / two weeks / this month against the span just before it, weekly series with
 * a smoothed rate, the spread of shift rates, and the newest shift against your last few of the same weekday and type.
 * Pure and derived from the shifts; nothing is stored. Rate is tips over hours, as everywhere. */

export type Focus = 'week' | 'fortnight' | 'month';
export interface Window { from: string; to: string; prevFrom: string; prevTo: string; days: number; label: string; prev: string }

/** The recent span to look at and the equal span before it (same days elapsed, so a half-finished week compares fairly). */
export function focusWindow(f: Focus, today: string): Window {
  const win = (from: string, prevFrom: string, prevTo: string, label: string, prev: string): Window =>
    ({ from, to: today, prevFrom, prevTo, days: daysBetween(from, today) + 1, label, prev });
  if (f === 'week') { const from = weekStart(today); return win(from, addDays(from, -7), addDays(today, -7), 'This week', 'last week'); }
  if (f === 'fortnight') { const from = addDays(today, -13); return win(from, addDays(from, -14), addDays(today, -14), 'Last 2 weeks', 'the 2 weeks before'); }
  const { y, m } = parts(today);
  return win(ymd(y, m, 1), ymd(y, m - 1, 1), addMonths(today, -1), 'This month', 'last month');
}

/** The shifts dated from..to, both included: a date filter only. Pending shifts stay in; summarize drops them itself. */
export const inDates = (views: ShiftView[], from: string, to: string): ShiftView[] => views.filter(v => v.shift.date >= from && v.shift.date <= to);

/** Percent change from `prev` to `now`; null when there is nothing to compare against. */
export const pctChange = (now: number | null | undefined, prev: number | null | undefined): number | null =>
  now == null || prev == null || prev === 0 ? null : ((now - prev) / prev) * 100;

/** Hours normalised to a 7-day span (the "40-hour week"): a span of two weeks or more is averaged per week; a part-week stays as it is. */
export const hoursPerWeek = (hours: number, days: number): number => (days >= 14 ? (hours * 7) / days : hours);

export interface WeekPoint {
  key: string;            // Monday
  n: number; hours: number; tips: number; total: number;
  tph: number | null;
  /** Tips per hour over this week and the three before it, weighted by hours: the trend without the week-to-week noise. */
  smooth: number | null;
  /** The current week, still in progress. */
  partial: boolean;
}

/** One point per Monday–Sunday week from `first` to `last` (both Mondays), oldest first. */
export function weeklyBetween(all: ShiftView[], first: string, last: string, today: string): WeekPoint[] {
  const thisWeek = weekStart(today), out: WeekPoint[] = [];
  // 1200 weeks is about 23 years. A bad first/last pair stops here instead of spinning.
  for (let k = first, guard = 0; k <= last && guard < 1200; k = addDays(k, 7), guard++) {
    const s = summarize(inDates(all, k, addDays(k, 6)));
    out.push({ key: k, n: s.shifts, hours: s.hours, tips: s.tips, total: s.total, tph: s.tph, smooth: summarize(inDates(all, addDays(k, -21), addDays(k, 6))).tph, partial: k === thisWeek });
  }
  return out;
}

/** The last `count` weeks up to this one, or every week since the first shift when null. */
export function weeklySeries(all: ShiftView[], today: string, count: number | null): WeekPoint[] {
  const thisWeek = weekStart(today);
  const oldest = all.map(v => v.shift.date).sort()[0];
  const first = count != null ? addDays(thisWeek, -7 * (count - 1)) : oldest ? weekStart(oldest) : thisWeek;
  return weeklyBetween(all, first, thisWeek, today);
}

export interface Histo { bins: { lo: number; hi: number; n: number }[]; width: number; mean: number; median: number }
/** Shift rates in even dollar bins (the widest bin count that still stays readable), with mean and median: their gap is the skew. */
export function histogram(values: number[]): Histo | null {
  if (values.length < 3) return null;
  const v = [...values].sort((a, b) => a - b);
  const width = [5, 10, 20, 25, 50, 100].find(w => Math.ceil((v.at(-1)! + 1e-9) / w) - Math.floor(v[0]! / w) <= 12) ?? 100;
  const lo = Math.floor(v[0]! / width) * width, count = Math.max(1, Math.ceil((v.at(-1)! + 1e-9) / width) - lo / width);
  const bins = Array.from({ length: count }, (_, i) => ({ lo: lo + i * width, hi: lo + (i + 1) * width, n: 0 }));
  for (const x of v) bins[Math.min(count - 1, Math.floor((x - lo) / width))]!.n++;
  const mid = v.length >> 1;
  return { bins, width, mean: v.reduce((a, b) => a + b, 0) / v.length, median: v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2 };
}

export interface SlotInsight { date: string; label: string; rate: number; base: number; n: number; pct: number | null }
/** Your newest shift with a rate against your last (up to 4) of the same weekday and type before it: "Wednesday night: 10% below your last 4". */
export function slotInsight(all: ShiftView[], take = 4): SlotInsight | null {
  const rated = all.filter(v => v.tph != null).sort((a, b) => b.shift.date.localeCompare(a.shift.date) || (b.shift.start ?? 0) - (a.shift.start ?? 0));
  const latest = rated[0];
  if (!latest) return null;
  const day = weekdayIndex(latest.shift.date), type = latest.shift.shift_type;
  const same = rated.slice(1).filter(v => v.shift.date < latest.shift.date && weekdayIndex(v.shift.date) === day && v.shift.shift_type === type).slice(0, take);
  const base = summarize(same).tph;
  if (!same.length || base == null) return null;
  return { date: latest.shift.date, label: `${WEEKDAY_NAMES[day]}${type ? ' ' + type : ''}`, rate: latest.tph!, base, n: same.length, pct: pctChange(latest.tph, base) };
}
