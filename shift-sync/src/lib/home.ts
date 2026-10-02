import { nextShift } from './blocks.ts';
import { waiting as toFill } from './dashboard.ts';
import { addDays, daysBetween, parts, weekStart, ymd } from './dates.ts';
import { MONTH_NAMES, MONTH_SHORT, WEEKDAY_SHORT } from './format.ts';
import { isPending, shiftStatus } from './groups.ts';
import { weekdayIndex } from './periods.ts';
import { addMonths } from './scope.ts';
import { summarize } from './stats.ts';
import type { ShiftView, Summary } from './stats.ts';
import { inDates, pctChange } from './trends.ts';

/* What Home reads: the five figures (take-home, tips, hours, tips per hour, total per hour) over the last 7 days against
 * the 7 before, a period so far against the same point of the one before, the pace those make a month and a year, how a
 * shift did against shifts like it (and what a booked one should bring), and a series by day, week or month with a
 * filter for any chart. Pure: pass today in. Only shifts with their money in count (`summarize`). */

/** The figures every comparison on Home can be made on. */
export type Metric = 'total' | 'tips' | 'hours' | 'tph' | 'perHour';
export const METRICS: { id: Metric; label: string; long: string }[] = [
  { id: 'total', label: 'Take-home', long: 'Take-home (tips, wage and other income)' },
  { id: 'tips', label: 'Tips', long: 'Tips' },
  { id: 'hours', label: 'Hours', long: 'Hours worked' },
  { id: 'tph', label: 'Tips/h', long: 'Tips per hour' },
  { id: 'perHour', label: 'Total/h', long: 'Take-home per hour' }
];
/** A metric's value in a summary; the two rates are null with no hours to divide by. */
export const valueOf = (s: Summary, m: Metric): number | null => (m === 'tph' ? s.tph : m === 'perHour' ? s.perHour : s[m]);
/** The rates are averages: they don't add up across periods, so a chart of them has no total. */
export const isRate = (m: Metric): boolean => m === 'tph' || m === 'perHour';

export interface Compared { now: Summary; before: Summary; delta: Record<Metric, number | null> }
const compare = (now: Summary, before: Summary): Compared => ({
  now, before,
  delta: Object.fromEntries(METRICS.map(m => [m.id, pctChange(valueOf(now, m.id), valueOf(before, m.id))])) as Record<Metric, number | null>
});

/** The last `days` days (today included) against the `days` before them: the trend chips. */
export function lastDays(all: ShiftView[], today: string, days = 7): Compared & { from: string } {
  const from = addDays(today, -(days - 1));
  return { from, ...compare(summarize(inDates(all, from, today)), summarize(inDates(all, addDays(from, -days), addDays(from, -1)))) };
}

export type SoFar = 'week' | 'month' | 'year';
/** This week, month or year up to today against the one before up to the same point (Monday to the same weekday, the
 *  1st to the same date, Jan 1 to the same date), so a period half gone compares fairly. */
export function soFar(all: ShiftView[], today: string, unit: SoFar): Compared & { from: string; prevFrom: string; prevTo: string } {
  const { y } = parts(today);
  const from = unit === 'week' ? weekStart(today) : unit === 'month' ? today.slice(0, 8) + '01' : `${y}-01-01`;
  const prevFrom = unit === 'week' ? addDays(from, -7) : unit === 'month' ? addMonths(from, -1) : `${y - 1}-01-01`;
  const prevTo = unit === 'week' ? addDays(today, -7) : unit === 'month' ? addMonths(today, -1) : addMonths(today, -12);
  return { from, prevFrom, prevTo, ...compare(summarize(inDates(all, from, today)), summarize(inDates(all, prevFrom, prevTo))) };
}

export interface Pace { weeks: number; perWeek: { total: number; tips: number; hours: number }; month: number; year: number }
/** What the last `weeks` full weeks (this one left out) average a week, and that as a month and a year of take-home.
 *  A week off counts: it is part of the pace. */
export function pace(all: ShiftView[], today: string, weeks = 8): Pace {
  const end = addDays(weekStart(today), -1), s = summarize(inDates(all, addDays(end, -(7 * weeks - 1)), end));
  const perWeek = { total: s.total / weeks, tips: s.tips / weeks, hours: s.hours / weeks };
  return { weeks, perWeek, month: (perWeek.total * 52) / 12, year: perWeek.total * 52 };
}

/* ── the KPI band: a window (the last 7 days, or a week, month or year so far) against the like-for-like stretches
 * before it. A stretch ends at the same point of its own period as today does of this one, so every dot on a spark and
 * the delta compare like with like. Typical is the median and middle half of the stretches before, never a mean (one
 * huge week would drag it), and never counts the stretch being judged. */
export type KpiWindow = 'last7' | 'week' | 'month' | 'year';   // not `Window`: that shadows the DOM global
export const KPI_WINDOWS: { id: KpiWindow; label: string }[] = [
  { id: 'last7', label: '7 days' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }
];
/** How many stretches a window's spark draws (the current one included). */
export const WINDOW_COUNT: Record<KpiWindow, number> = { last7: 8, week: 8, month: 6, year: 3 };
export interface Stretch { from: string; to: string; s: Summary }

/** `count` like-for-like stretches ending with the one holding today, oldest first. */
export function likeWindows(all: ShiftView[], today: string, w: KpiWindow, count = WINDOW_COUNT[w]): Stretch[] {
  const { y } = parts(today), out: Stretch[] = [];
  for (let j = count - 1; j >= 0; j--) {
    const [from, to] =
      w === 'last7' ? [addDays(today, -6 - 7 * j), addDays(today, -7 * j)]
      : w === 'week' ? [addDays(weekStart(today), -7 * j), addDays(today, -7 * j)]
      : w === 'month' ? [addMonths(today.slice(0, 8) + '01', -j), addMonths(today, -j)]
      : [`${y - j}-01-01`, addMonths(today, -12 * j)];
    out.push({ from, to, s: summarize(inDates(all, from, to)) });
  }
  return out;
}

export interface Typical extends Spread { n: number }
/** The middle half of some values (nulls left out) and how many there were; null with fewer than `min`. */
export function typicalOf(values: (number | null)[], min = 3): Typical | null {
  const v = values.filter((x): x is number => x != null);
  return v.length < min ? null : { ...spread(v), n: v.length };
}

export interface KpiContext {
  w: KpiWindow;
  now: Stretch;
  before: Stretch | null;
  delta: Record<Metric, number | null>;
  /** Over the stretches before this one: what this window usually brings. */
  typical: Record<Metric, Typical | null>;
  /** One value per stretch, oldest first, the last being now's; null before any history (or no rate to show). */
  spark: Record<Metric, (number | null)[]>;
  /** Shifts in the window worked but still waiting on their money: not counted, and said so. */
  waiting: ShiftView[];
  /** How far into its period the window is ('day 2 of 31'); null for the rolling 7 days. */
  elapsed: { day: number; of: number } | null;
}

const byMetric = <T>(f: (m: Metric) => T) => Object.fromEntries(METRICS.map(m => [m.id, f(m.id)])) as Record<Metric, T>;

export function kpiContext(all: ShiftView[], today: string, w: KpiWindow, count = WINDOW_COUNT[w]): KpiContext {
  const stretches = likeWindows(all, today, w, count), now = stretches[stretches.length - 1]!, before = stretches[stretches.length - 2] ?? null;
  const first = all.reduce<string | null>((f, v) => (isPending(v) || (f != null && f <= v.shift.date) ? f : v.shift.date), null);
  const spark = byMetric(m => stretches.map(st => (first == null || st.to < first ? null : valueOf(st.s, m))));
  const { y, m, d } = parts(today);
  return {
    w, now, before,
    delta: before ? compare(now.s, before.s).delta : byMetric(() => null),
    typical: byMetric(k => typicalOf(spark[k].slice(0, -1))),
    spark,
    waiting: inDates(all, now.from, now.to).filter(v => shiftStatus(v) === 'worked'),
    elapsed:
      w === 'last7' ? null
      : w === 'week' ? { day: daysBetween(weekStart(today), today) + 1, of: 7 }
      : w === 'month' ? { day: d, of: parts(addDays(ymd(y, m + 1, 1), -1)).d }
      : { day: daysBetween(`${y}-01-01`, today) + 1, of: daysBetween(`${y}-01-01`, `${y + 1}-01-01`) }
  };
}

/** The window's title: 'Last 7 days', 'This week so far', 'October so far', '2026 so far'. */
export function windowName(w: KpiWindow, today: string): string {
  const { y, m } = parts(today);
  return w === 'last7' ? 'Last 7 days' : w === 'week' ? 'This week so far' : w === 'month' ? `${MONTH_NAMES[m]} so far` : `${y} so far`;
}

/* ── tonight: the one shift today is about, what comes after it, and what is still waiting on its money ────────── */
export interface Tonight { kind: 'booked' | 'waiting' | 'done' | 'off'; view: ShiftView | null; next: ShiftView | null; waiting: ShiftView[] }

/** Today's shift (one worked and waiting first, then the earliest still booked, then the last done), the next booked
 *  shift after today, and the days before today still waiting on tips, oldest first. */
export function tonight(all: ShiftView[], today: string): Tonight {
  const day = all.filter(v => v.shift.date === today).sort((a, b) => (a.shift.start ?? 0) - (b.shift.start ?? 0));
  const of = (st: string) => day.filter(v => shiftStatus(v) === st);
  const view = of('worked')[0] ?? of('scheduled')[0] ?? of('done').at(-1) ?? null;
  const st = view && shiftStatus(view);
  return {
    kind: st === 'scheduled' ? 'booked' : st === 'worked' ? 'waiting' : st === 'done' ? 'done' : 'off',
    view,
    next: nextShift(all, addDays(today, 1)),
    waiting: toFill(all).filter(v => shiftStatus(v) === 'worked' && v.shift.date < today)
  };
}

/* ── shifts like this one ──────────────────────────────────────────────────────────────────────────────────────
 * Day or night always matters, and so does a party (party nights pay more). The weekday matters too, but one bar only
 * has so many Wednesday party nights, so the match loosens until there are enough to say anything:
 *   1. same type, same party-or-not, same weekday    (4 or more)
 *   2. same type, same party-or-not                  (3 or more)
 *   3. same type                                     (3 or more)
 * Only finished shifts before it, in the 26 weeks before it, and the 12 most recent of the tier that holds. */
export interface Similar {
  /** Who it's measured against, in words: 'Fri nights', 'party nights', 'nights'. */
  label: string;
  views: ShiftView[];
  s: Summary;
  /** The middle half of what one of them brought: the 25th, 50th and 75th percentile. */
  tips: Spread;
  total: Spread;
  /** The same for tips per hour, over the ones with a rate; null with fewer than 3 of those. */
  tph: Spread | null;
}
export interface Spread { lo: number; mid: number; hi: number }

const quantile = (sorted: number[], p: number) => {
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
};
export const spread = (values: number[]): Spread => {
  const v = [...values].sort((a, b) => a - b);
  return { lo: quantile(v, 0.25), mid: quantile(v, 0.5), hi: quantile(v, 0.75) };
};

const typeWord = (t: string | null, n: number) => (t === 'day' ? (n === 1 ? 'day shift' : 'day shifts') : t === 'night' ? (n === 1 ? 'night' : 'nights') : n === 1 ? 'shift' : 'shifts');

export function similarShifts(all: ShiftView[], target: ShiftView, weeks = 26, take = 12): Similar | null {
  const t = target.shift, from = addDays(t.date, -7 * weeks), wd = weekdayIndex(t.date);
  const pool = all.filter(v => v.shift.id !== t.id && !isPending(v) && v.shift.date < t.date && v.shift.date >= from && v.shift.shift_type === t.shift_type)
    .sort((a, b) => b.shift.date.localeCompare(a.shift.date));
  const party = pool.filter(v => !!v.shift.party === !!t.party);
  const tiers: { views: ShiftView[]; min: number; label: string }[] = [
    { views: party.filter(v => weekdayIndex(v.shift.date) === wd), min: 4, label: `${WEEKDAY_SHORT[wd]} ${t.party ? 'party ' : ''}${typeWord(t.shift_type, 2)}` },
    { views: party, min: 3, label: `${t.party ? 'party ' : ''}${typeWord(t.shift_type, 2)}` },
    { views: pool, min: 3, label: typeWord(t.shift_type, 2) }
  ];
  const hit = tiers.find(x => x.views.length >= x.min);
  if (!hit) return null;
  const views = hit.views.slice(0, take), rates = views.flatMap(v => (v.tph == null ? [] : [v.tph]));
  return {
    label: hit.label, views, s: summarize(views),
    tips: spread(views.map(v => v.shift.tips ?? 0)), total: spread(views.map(v => v.total)),
    tph: rates.length >= 3 ? spread(rates) : null
  };
}

/** A finished shift against shifts like it: the change in `metric` (tips per hour unless said), or null. */
export function versusSimilar(all: ShiftView[], v: ShiftView, metric: Metric = 'tph'): { pct: number | null; like: Similar } | null {
  if (isPending(v)) return null;
  const like = similarShifts(all, v);
  if (!like) return null;
  const one = summarize([v]);
  return { pct: pctChange(valueOf(one, metric), valueOf(like.s, metric)), like };
}

/** What a shift still to come should bring, from shifts like it: the middle half of their tips and take-home. */
export const forecast = (all: ShiftView[], v: ShiftView): Similar | null => (isPending(v) ? similarShifts(all, v) : null);

export interface WeekPace { done: number; ahead: number; expected: number; booked: number; unknown: number }
/** This week's take-home so far, plus the middle of what each booked (or still unpaid) shift should bring. */
export function weekPace(all: ShiftView[], today: string): WeekPace {
  const from = weekStart(today), week = inDates(all, from, addDays(from, 6));
  let ahead = 0, booked = 0, unknown = 0;
  for (const v of week.filter(isPending)) {
    const f = forecast(all, v);
    booked++;
    if (f) ahead += f.total.mid; else unknown++;
  }
  const done = summarize(week).total;
  return { done, ahead, expected: done + ahead, booked, unknown };
}

/* ── a series for a chart: grouped by day, week or month, over a range, through a filter ─────────────────────── */
export type Grain = 'day' | 'week' | 'month';
export interface ShiftFilter { type: 'any' | 'day' | 'night'; party: 'any' | 'yes' | 'no' }
export const ANY: ShiftFilter = { type: 'any', party: 'any' };
export const applyFilter = (views: ShiftView[], f: ShiftFilter): ShiftView[] =>
  views.filter(v => (f.type === 'any' || v.shift.shift_type === f.type) && (f.party === 'any' || !!v.shift.party === (f.party === 'yes')));

/** How many of each grain a range can show, and the one it starts on. */
export const RANGES: Record<Grain, { choices: number[]; start: number }> = {
  day: { choices: [14, 30, 60], start: 30 },
  week: { choices: [8, 12, 26, 52], start: 12 },
  month: { choices: [6, 12, 24], start: 12 }
};

export interface Point { key: string; label: string; title: string; s: Summary; partial: boolean }
/** The last `count` days, weeks or months up to the one holding today, oldest first. */
export function series(all: ShiftView[], today: string, grain: Grain, count: number, filter: ShiftFilter = ANY): Point[] {
  const views = applyFilter(all, filter), out: Point[] = [];
  const { y, m } = parts(today);
  for (let i = count - 1; i >= 0; i--) {
    let from: string, to: string, label: string, title: string;
    if (grain === 'day') {
      from = to = addDays(today, -i);
      label = String(+from.slice(8)); title = `${WEEKDAY_SHORT[weekdayIndex(from)]} ${MONTH_SHORT[+from.slice(5, 7) - 1]} ${+from.slice(8)}`;
    } else if (grain === 'week') {
      from = addDays(weekStart(today), -7 * i); to = addDays(from, 6);
      label = `${+from.slice(5, 7)}/${+from.slice(8)}`; title = `Week of ${MONTH_SHORT[+from.slice(5, 7) - 1]} ${+from.slice(8)}`;
    } else {
      from = ymd(y, m - i, 1); to = addDays(ymd(y, m - i + 1, 1), -1);
      const mo = +from.slice(5, 7) - 1;
      label = MONTH_SHORT[mo]!; title = `${MONTH_SHORT[mo]} ${from.slice(0, 4)}`;
    }
    out.push({ key: from, label, title, s: summarize(inDates(views, from, to)), partial: today >= from && today < to });
  }
  return out;
}
