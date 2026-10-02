import { CATEGORIES } from '../core/core.generated.js';
import type { Category } from '../core/core.generated.js';
import { addDays, parts, weekStart } from './dates.ts';
import { isPending } from './groups.ts';
import { summarize } from './stats.ts';
import type { ShiftView } from './stats.ts';
import { inDates } from './trends.ts';

/* The numbers behind the dashboard blocks (parts/blocks): income per week by source, the weekday × week rate heatmap,
 * a month's running total against the month before, and the week ahead. Pure: pass today in. Weeks are the app's
 * Monday-to-Sunday weeks (`weekStart`), the same weeks every other page groups by. */

/** Every source a week's money can come from, in stacking order: Tips at the base, then Wage, then each Other source. */
export type Source = 'Tips' | 'Wage' | Category | 'Other';
export const SOURCES: Source[] = ['Tips', 'Wage', ...CATEGORIES, 'Other'];

export interface IncomeWeek {
  key: string;            // the Monday
  partial: boolean;       // this week, still running
  by: Partial<Record<Source, number>>;
  total: number;
  n: number;              // shifts with money in
}

/** Money per week by source, oldest first, for the `count` weeks up to this one. Pending shifts count nothing. */
export function incomeByWeek(all: ShiftView[], today: string, count: number): IncomeWeek[] {
  const now = weekStart(today), out: IncomeWeek[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const key = addDays(now, -7 * i), views = inDates(all, key, addDays(key, 6)).filter(v => !isPending(v));
    const by = bySource(views);
    out.push({ key, partial: key === now, by, total: Object.values(by).reduce((t, n) => t + (n ?? 0), 0), n: views.length });
  }
  return out;
}

/** Money by source over some shifts (a week, a day). Shifts still waiting on their money count nothing. */
export function bySource(views: ShiftView[]): Partial<Record<Source, number>> {
  const by: Partial<Record<Source, number>> = {};
  const add = (s: Source, n: number) => { if (n) by[s] = (by[s] ?? 0) + n; };
  for (const v of views) {
    if (isPending(v)) continue;
    add('Tips', v.shift.tips ?? 0);
    add('Wage', v.wage ?? 0);
    for (const line of v.income) add(line.category, line.amount);
    add('Other', v.shift.other ?? 0);
  }
  return by;
}

/** What a source is called in a key, a tooltip or a row label. */
export const SOURCE_NAME: Record<Source, string> = { Tips: 'Tips', Wage: 'Wage (est.)', Chump: 'Chump', Cash: 'Cash', Venmo: 'Venmo', Consideration: 'Consideration', Overtime: 'Overtime', Other: 'Earlier entry' };

export interface WeekPerson { id: string; name: string | null; you: boolean; days: { date: string; start: number | null; end: number | null; location: string | null }[]; hours: number }

/** Everyone on a shift in these days, one row each (you first, then most hours), with their own times per day: the
 *  roster rows under a week strip. `isYou` and `nameOf` come from the store so this stays pure. */
export function weekPeople(days: AgendaDay[], isYou: (id: string) => boolean, hoursOf: (start: number | null, end: number | null) => number | null): WeekPerson[] {
  const map = new Map<string, WeekPerson>();
  for (const d of days) for (const v of d.views) for (const c of v.crew) {
    const p = map.get(c.staff_id) ?? { id: c.staff_id, name: c.name, you: isYou(c.staff_id), days: [], hours: 0 };
    p.days.push({ date: d.date, start: c.start, end: c.end, location: c.location });
    p.hours += hoursOf(c.start, c.end) ?? 0;
    map.set(c.staff_id, p);
  }
  return [...map.values()].sort((a, b) => Number(b.you) - Number(a.you) || b.hours - a.hours || (a.name ?? '').localeCompare(b.name ?? ''));
}

/** The sources that appear at all across these weeks, in stacking order: a key never lists a source with nothing in it. */
export const sourcesIn = (weeks: IncomeWeek[]): Source[] => SOURCES.filter(s => weeks.some(w => (w.by[s] ?? 0) > 0));

export interface HeatCell { date: string; tph: number | null; tips: number; n: number; future: boolean }
export interface Heat {
  /** Mondays, oldest first: one column each. */
  weeks: string[];
  /** rows[weekday 0 = Monday][week] */
  rows: HeatCell[][];
  /** The highest rate in view, the top of the shading. */
  max: number;
}

/** Tips per hour for each day of the last `count` weeks, as weekday rows: the shape of which nights pay. */
export function rateHeat(all: ShiftView[], today: string, count: number): Heat {
  const now = weekStart(today), weeks = Array.from({ length: count }, (_, i) => addDays(now, -7 * (count - 1 - i)));
  const byDate = new Map<string, ShiftView[]>();
  for (const v of all) byDate.set(v.shift.date, [...(byDate.get(v.shift.date) ?? []), v]);
  let max = 0;
  const rows = Array.from({ length: 7 }, (_, d) => weeks.map(w => {
    const date = addDays(w, d), list = byDate.get(date) ?? [], s = summarize(list);
    if (s.tph != null) max = Math.max(max, s.tph);
    return { date, tph: s.tph, tips: s.tips, n: list.length, future: date > today };
  }));
  return { weeks, rows, max };
}

export interface Running {
  /** Days in the month shown. */
  days: number;
  /** Running total by day of month (index 0 = the 1st); null past today. */
  now: (number | null)[];
  /** The month before, running total by the same day numbers (its last value carried to the end if it was shorter). */
  prev: number[];
  month: string;          // 'YYYY-MM'
  prevMonth: string;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const run = (all: ShiftView[], y: number, m: number, days: number, pick: (v: ShiftView) => number) => {
  const key = `${y}-${String(m + 1).padStart(2, '0')}`, per = new Array<number>(days).fill(0);
  for (const v of all) if (v.shift.date.startsWith(key) && !isPending(v)) { const d = +v.shift.date.slice(8) - 1; if (d < days) per[d]! += pick(v); }
  let t = 0;
  return { key, values: per.map(n => (t += n)) };
};

/** This month's running total against last month's, day by day: are you ahead of where you were? `pick` is the money
 *  that counts (Total by default). The month is today's unless `month` ('YYYY-MM') says otherwise. */
export function runningMonth(all: ShiftView[], today: string, pick: (v: ShiftView) => number = v => v.total, month?: string): Running {
  const t = parts(today), y = month ? +month.slice(0, 4) : t.y, m = month ? +month.slice(5, 7) - 1 : t.m;
  const days = daysIn(y, m), py = m === 0 ? y - 1 : y, pm = (m + 11) % 12, pdays = daysIn(py, pm);
  const cur = run(all, y, m, days, pick), before = run(all, py, pm, pdays, pick);
  const cut = cur.key === today.slice(0, 7) ? t.d : cur.key < today.slice(0, 7) ? days : 0;
  return {
    days, month: cur.key, prevMonth: before.key,
    now: cur.values.map((n, i) => (i < cut ? n : null)),
    prev: Array.from({ length: days }, (_, i) => before.values[Math.min(i, pdays - 1)]!)
  };
}

export interface AgendaDay {
  date: string;
  views: ShiftView[];
  /** today, a day already gone, or one still to come */
  when: 'past' | 'today' | 'ahead';
}

/** The seven days of the week holding `today` (or `offset` weeks from it), each with its shifts, earliest start first. */
export function weekAgenda(all: ShiftView[], today: string, offset = 0): AgendaDay[] {
  const start = addDays(weekStart(today), offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const views = all.filter(v => v.shift.date === date).sort((a, b) => (a.shift.start ?? 0) - (b.shift.start ?? 0));
    return { date, views, when: date < today ? 'past' : date === today ? 'today' : 'ahead' };
  });
}

/** The next shift on or after today that hasn't happened yet, or null: the agenda's "up next". */
export const nextShift = (all: ShiftView[], today: string): ShiftView | null =>
  all.filter(v => v.shift.date >= today && isPending(v)).sort((a, b) => a.shift.date.localeCompare(b.shift.date) || (a.shift.start ?? 0) - (b.shift.start ?? 0))[0] ?? null;

/** Each share of a whole as a percent, rounded so the parts add up to exactly 100 (largest remainder). */
export function shares(values: number[]): number[] {
  const total = values.reduce((t, n) => t + n, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map(n => (n / total) * 100), floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((t, n) => t + n, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem);
  for (const o of order) { if (left <= 0) break; floor[o.i]!++; left--; }
  return floor;
}

/* ── one value per day, for the compact calendars (the day chips, the GitHub-style heatmap, the tips month) ── */
export type DayMetric = 'tips' | 'rate' | 'hours' | 'total';
export interface DayValue {
  date: string;
  /** The day's figure: tips, tips per hour, hours or total; null when nothing on the day has its money in. */
  value: number | null;
  /** Shifts on the day, counted or not. */
  n: number;
  /** Every shift on the day is still waiting (booked, or worked with no money in). */
  pending: boolean;
  views: ShiftView[];
}

/** Each day from `from` to `to` (inclusive, oldest first) with its figure. */
export function dailyValues(all: ShiftView[], from: string, to: string, metric: DayMetric): DayValue[] {
  const by = new Map<string, ShiftView[]>();
  for (const v of all) if (v.shift.date >= from && v.shift.date <= to) by.set(v.shift.date, [...(by.get(v.shift.date) ?? []), v]);
  const out: DayValue[] = [];
  // 4000 days is about 11 years: a bad pair stops here instead of spinning.
  for (let d = from, guard = 0; d <= to && guard < 4000; d = addDays(d, 1), guard++) {
    const views = by.get(d) ?? [], s = summarize(views);
    const value = !s.shifts ? null : metric === 'tips' ? s.tips : metric === 'rate' ? s.tph : metric === 'hours' ? s.hours : s.total;
    out.push({ date: d, value, n: views.length, pending: views.length > 0 && views.every(isPending), views });
  }
  return out;
}

/** A shade level 1 to 4 for a value, by the quartiles of the values given (so one huge night doesn't wash every other
 *  day out); 0 for no value. Fewer than two values: anything present is level 2. */
export function levelScale(values: (number | null)[]): (v: number | null) => 0 | 1 | 2 | 3 | 4 {
  const v = values.filter((x): x is number => x != null && x > 0).sort((a, b) => a - b);
  if (v.length < 2) return x => (x == null || x <= 0 ? 0 : 2);
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))]!;
  const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
  return x => (x == null || x <= 0 ? 0 : x < t1 ? 1 : x < t2 ? 2 : x < t3 ? 3 : 4);
}

/** The Mondays of the `weeks` weeks ending with the week holding `end`, oldest first: a heatmap's columns. */
export const weekColumns = (end: string, weeks: number): string[] => {
  const last = weekStart(end);
  return Array.from({ length: weeks }, (_, i) => addDays(last, -7 * (weeks - 1 - i)));
};
