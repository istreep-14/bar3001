import { addDays, monthKey, parts, weekday, ymd } from './dates.ts';
import { startOf } from './scope.ts';
import type { Scope } from './scope.ts';
import { summarize } from './stats.ts';
import type { ShiftView, Summary } from './stats.ts';

/* What the Overview draws: totals per week (or per month when the range is long), and tips per hour compared by
 * type, weekday or party. Pure and derived from the shifts on the page, nothing stored. Weeks run Monday to Sunday,
 * the way a bar week does. */

/** Monday of the week a date falls in. */
export const mondayOf = (d: string): string => addDays(d, -((weekday(d) + 6) % 7));
/** 0 = Monday. */
export const weekdayIndex = (d: string): number => (weekday(d) + 6) % 7;

export interface Bucket { key: string; n: number; hours: number; tips: number; wage: number; extra: number; total: number }

/** The range a scope covers, as first and last date. An open range starts at the oldest shift. */
export function scopeBounds(scope: Scope, views: ShiftView[], today: string): { from: string; to: string } {
  const dates = views.map(v => v.shift.date).sort();
  const oldest = dates[0] ?? today;
  if (scope.mode === 'range') return { from: scope.from, to: scope.to };
  if (scope.mode === 'all') return { from: oldest, to: today };
  if (scope.unit === 'shifts') return { from: dates.at(-scope.n) ?? oldest, to: today };
  return { from: startOf(scope.n, scope.unit, today), to: today };
}

const blank = (key: string): Bucket => ({ key, n: 0, hours: 0, tips: 0, wage: 0, extra: 0, total: 0 });

/** Totals per period, oldest first, with empty periods kept so gaps in work show as gaps. */
export function periods(views: ShiftView[], from: string, to: string): { monthly: boolean; buckets: Bucket[] } {
  const spanDays = Math.max(1, Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000));
  const monthly = spanDays > 26 * 7;
  const keyOf = (d: string) => (monthly ? monthKey(d) : mondayOf(d));
  const step = (k: string) => (monthly ? monthKey(ymd(parts(k + '-01').y, parts(k + '-01').m + 1, 1)) : addDays(k, 7));
  const map = new Map<string, Bucket>();
  for (let k = keyOf(from), guard = 0; k <= keyOf(to) && guard < 2000; k = step(k), guard++) map.set(k, blank(k));
  for (const v of views) {
    const b = map.get(keyOf(v.shift.date));
    if (!b) continue;
    b.n += 1; b.hours += v.hours ?? 0; b.tips += v.shift.tips ?? 0; b.wage += v.wage ?? 0; b.extra += v.extra; b.total += v.total;
  }
  return { monthly, buckets: [...map.values()] };
}

export interface Group { key: string; label: string; s: Summary }
/** Shifts split by a key, each group summarized. Groups keep the order of `keys`. */
export function groupBy(views: ShiftView[], keys: { key: string; label: string }[], keyOf: (v: ShiftView) => string): Group[] {
  const by = new Map<string, ShiftView[]>(keys.map(k => [k.key, []]));
  for (const v of views) by.get(keyOf(v))?.push(v);
  return keys.map(k => ({ ...k, s: summarize(by.get(k.key) ?? []) }));
}

/** A round top for an axis: 0..top in clean steps (1, 2, 5 × 10ⁿ). */
export function niceScale(max: number, target = 4): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / target, pow = 10 ** Math.floor(Math.log10(raw)), f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(+v.toFixed(6));
  return { top, ticks };
}
