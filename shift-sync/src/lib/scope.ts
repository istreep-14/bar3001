import { addDays, parts, ymd } from './dates.ts';

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
