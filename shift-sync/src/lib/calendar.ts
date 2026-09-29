import { addDays, daysBetween, pad, parts, weekStart } from './dates.ts';
import type { ShiftView } from './stats.ts';

/* The month grid the Calendar page and the form's date picker share. Its rows are the app's weeks (`WEEK_START`). */
export interface Cell { date: string; inMonth: boolean }

/** Whole weeks covering a month: the days of the month plus the neighbours that complete its first and last week. */
export function monthGrid(y: number, m: number): Cell[] {
  const first = `${y}-${pad(m + 1)}-01`;
  const offset = daysBetween(weekStart(first), first);
  const days = parts(addDays(`${m === 11 ? y + 1 : y}-${pad(((m + 1) % 12) + 1)}-01`, -1)).d;
  const rows = Math.ceil((offset + days) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => {
    const date = addDays(first, i - offset);
    return { date, inMonth: date.slice(0, 7) === first.slice(0, 7) };
  });
}

export const byDate = (views: ShiftView[]): Map<string, ShiftView[]> => {
  const map = new Map<string, ShiftView[]>();
  for (const v of views) map.set(v.shift.date, [...(map.get(v.shift.date) ?? []), v]);
  return map;
};

/* Shading by rate: a day is coloured by how its tips per hour compares with the typical shift in view, not by how much it
 * earned. Above the median leans on the primary colour, below it on amber; the further from the median, the deeper. */
export interface RateScale { median: number; span: number; at: (rate: number | null) => { mag: number; side: 'hi' | 'lo' } | null }
export function rateScale(rates: (number | null)[]): RateScale | null {
  const v = rates.filter((r): r is number => r != null).sort((a, b) => a - b);
  if (v.length < 2) return null;
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]!;
  const median = q(0.5), span = Math.max(q(0.9) - median, median - q(0.1), 1e-9);
  return { median, span, at: r => (r == null ? null : { mag: Math.min(1, Math.abs(r - median) / span), side: r >= median ? 'hi' : 'lo' }) };
}
