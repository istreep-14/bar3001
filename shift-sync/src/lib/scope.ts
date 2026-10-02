import { addDays, daysBetween, parts, ymd } from './dates.ts';

/* One scope model for every page that shows a period (Log, Table, Totals, the Hub lists).
 *   last     the most recent N days / weeks / months / years, or the N most recent shifts
 *   range    custom from/to dates
 *   all      everything */
export type Unit = 'days' | 'weeks' | 'months' | 'years' | 'shifts';
export type Scope =
  | { mode: 'last'; n: number; unit: Unit }
  | { mode: 'range'; from: string; to: string }
  | { mode: 'all' };

export const UNITS: { id: Unit; label: string }[] = [
  { id: 'days', label: 'days' }, { id: 'weeks', label: 'weeks' }, { id: 'months', label: 'months' },
  { id: 'years', label: 'years' }, { id: 'shifts', label: 'shifts' }
];
export const PRESETS: { label: string; scope: Scope }[] = [
  { label: '7d', scope: { mode: 'last', n: 7, unit: 'days' } },
  { label: '30d', scope: { mode: 'last', n: 30, unit: 'days' } },
  { label: '90d', scope: { mode: 'last', n: 90, unit: 'days' } },
  { label: '1y', scope: { mode: 'last', n: 1, unit: 'years' } },
  { label: 'All', scope: { mode: 'all' } }
];
const copyScope = (s: Scope): Scope =>
  s.mode === 'last' ? { mode: 'last', n: s.n, unit: s.unit } : s.mode === 'range' ? { mode: 'range', from: s.from, to: s.to } : { mode: 'all' };
/** The period a new device starts on: the 30-day preset, copied so editing that preset object later cannot move the default. */
export const DEFAULT_SCOPE: Scope = copyScope(PRESETS[1]!.scope);
export const MAX_N = 999;

export const sameScope = (a: Scope, b: Scope): boolean =>
  a.mode === b.mode && (a.mode === 'all' || (a.mode === 'last' && b.mode === 'last' && a.n === b.n && a.unit === b.unit) ||
    (a.mode === 'range' && b.mode === 'range' && a.from === b.from && a.to === b.to));

/** Adds calendar months, clamping the day (Mar 31 minus 1 month = Feb 28). */
export function addMonths(d: string, k: number): string {
  const { y, m, d: day } = parts(d);
  const last = parts(addDays(ymd(y, m + k + 1, 1), -1)).d;
  return ymd(y, m + k, Math.min(day, last));
}

/** First date included by a date-based 'last N' scope; today counts as day 1. Null for 'shifts'. */
export function startOf(n: number, unit: Exclude<Unit, 'shifts'>, today: string): string {
  switch (unit) {
    case 'days': return addDays(today, -(n - 1));
    case 'weeks': return addDays(today, -(7 * n - 1));
    case 'months': return addDays(addMonths(today, -n), 1);
    case 'years': return addDays(addMonths(today, -12 * n), 1);
  }
}

/** The shifts a scope selects. Open-ended on the right, so a shift logged ahead of time still shows. */
export function applyScope<T extends { shift: { date: string } }>(views: T[], s: Scope, today: string): T[] {
  if (s.mode === 'all') return views;
  if (s.mode === 'range') return views.filter(v => v.shift.date >= s.from && v.shift.date <= s.to);
  if (s.unit === 'shifts') return [...views].sort((a, b) => b.shift.date.localeCompare(a.shift.date)).slice(0, s.n);
  const from = startOf(s.n, s.unit, today);
  return views.filter(v => v.shift.date >= from);
}

const at = (d: string) => new Date(d + 'T12:00:00');
const md = (d: string) => at(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const mdy = (d: string) => at(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** What the scope currently covers, in words. */
export function labelOf(s: Scope, today: string): string {
  if (s.mode === 'all') return 'All time';
  if (s.mode === 'range') return `${mdy(s.from)} – ${mdy(s.to)}`;
  if (s.unit === 'shifts') return `Latest ${s.n} ${s.n === 1 ? 'shift' : 'shifts'}`;
  const from = startOf(s.n, s.unit, today);   // the year appears only when the period reaches back past this one
  return `${from.slice(0, 4) === today.slice(0, 4) ? md(from) : mdy(from)} – ${md(today)}`;
}

/** Clamp typed input to a usable whole number. */
export const clampN = (v: number): number | null => (Number.isFinite(v) && v >= 1 ? Math.min(MAX_N, Math.floor(v)) : null);

/* ── the period before ────────────────────────────────────────────────────────────────────────────────────────
 * What a scope is compared against: the equal span just before it. Side panels read it ("Against the 30 days before",
 * a DeltaPill per figure, 'from $5,080'). */

/** The scope the current one is compared with: the equal span that ends the day before it starts, as a range.
 *  'last N days/weeks/months/years' gives the same N ending the day before; a custom range the same number of days
 *  before it; 'last N shifts' the range covering the N shifts before the oldest one in view (pass `views`, newest or
 *  not, every shift you have); 'all' has nothing before it, so null. Also null for 'shifts' when nothing is older. */
export function priorScope<T extends { shift: { date: string } }>(s: Scope, today: string, views: T[] = []): Scope | null {
  if (s.mode === 'all') return null;
  if (s.mode === 'range') {
    const len = daysBetween(s.from, s.to) + 1;
    return { mode: 'range', from: addDays(s.from, -len), to: addDays(s.from, -1) };
  }
  if (s.unit === 'shifts') {
    const prior = priorViews(views, s, today) ?? [];
    if (prior.length === 0) return null;
    const dates = prior.map(v => v.shift.date).sort();
    return { mode: 'range', from: dates[0]!, to: dates[dates.length - 1]! };
  }
  const start = startOf(s.n, s.unit, today), end = addDays(start, -1);
  return { mode: 'range', from: startOf(s.n, s.unit, end), to: end };
}

/** The shifts of the period before (see `priorScope`), or null when the scope has none ('all'). For 'last N shifts' it
 *  is exactly the N shifts after the newest N, by date then start, so two shifts on one day never land in both. */
export function priorViews<T extends { shift: { date: string; start?: number | null } }>(views: T[], s: Scope, today: string): T[] | null {
  if (s.mode === 'all') return null;
  if (s.mode === 'last' && s.unit === 'shifts') {
    const sorted = [...views].sort((a, b) => b.shift.date.localeCompare(a.shift.date) || (b.shift.start ?? 0) - (a.shift.start ?? 0));
    return sorted.slice(s.n, 2 * s.n);
  }
  const p = priorScope(s, today)!;
  return applyScope(views, p, today);
}

const UNIT_WORD: Record<Exclude<Unit, 'shifts'>, [string, string]> = { days: ['day', 'days'], weeks: ['week', 'weeks'], months: ['month', 'months'], years: ['year', 'years'] };
/** The period before, in words, to follow "Against" or "no shifts": 'the 30 days before', 'the month before', 'the 20
 *  shifts before', or a custom range's dates ('Aug 3 – Sep 1'). Null for 'all'. */
export function priorLabel(s: Scope, today: string): string | null {
  if (s.mode === 'all') return null;
  if (s.mode === 'range') {
    const p = priorScope(s, today) as { from: string; to: string };
    const yr = (d: string) => d.slice(0, 4) !== today.slice(0, 4);
    return `${yr(p.from) ? mdy(p.from) : md(p.from)} – ${yr(p.to) ? mdy(p.to) : md(p.to)}`;
  }
  if (s.unit === 'shifts') return `the ${s.n === 1 ? 'shift' : `${s.n} shifts`} before`;
  const [one, many] = UNIT_WORD[s.unit];
  return `the ${s.n === 1 ? one : `${s.n} ${many}`} before`;
}
