import { toHHMM } from '../core/core.generated.js';
import { addDays, weekStart } from './dates.ts';

const money2 = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const DASH = '\u2014';
/** Money is always two decimals, and absent is an em dash, so a column never mixes formats. */
export const money = (n: number | null | undefined): string => (n == null ? DASH : money2.format(n));
/** Whole dollars, only where two decimals cannot fit (axis and bar labels). */
export const moneyWhole = (n: number): string => money0.format(n);
/** Whole dollars in a sentence, or a dash when the figure is absent. */
export const dollars = (n: number | null | undefined): string => (n == null ? DASH : moneyWhole(n));
/** '$12.4/hr', or a dash when there is no rate. */
export const perHour = (n: number | null | undefined): string => (n == null ? DASH : `$${n.toFixed(1)}/hr`);

export const hours = (h: number | null | undefined): string => (h == null ? DASH : `${+h.toFixed(1)}h`);

/** Exact and fixed-width ('06:00 PM'), so every time has the same digits and lines up. */
export const clock = (min: number | null): string => {
  if (min == null) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
/** Table form: 'h:mm' plus a/p, no leading zero ('6:00p', '1:15a'). The full time is in the cell's tooltip. */
export const clockShort = (min: number | null): string =>
  min == null ? '' : `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, '0')}${min < 720 ? 'a' : 'p'}`;
/** Reading form: '6:00 PM', '12:15 AM'. No leading zero and never 24-hour; for rows where times sit in a sentence-like cell. */
export const clockPlain = (min: number | null): string =>
  min == null ? '' : `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, '0')} ${min < 720 ? 'AM' : 'PM'}`;
export const timeRange = (start: number | null, end: number | null): string =>
  start == null || end == null ? '' : `${clock(start)} – ${clock(end)}`;

/** One decimal for hours in tables: 8.2, 9.5. */
export const dec1 = (n: number | null | undefined): string => (n == null ? DASH : n.toFixed(1));

/** Whole numbers for table cells: hours, income, rates. Exact figures live in the drawer. */
export const int = (n: number | null | undefined): string =>
  n == null ? DASH : Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const at = (d: string) => new Date(d + 'T12:00:00');
export const dayLabel = (d: string): { weekday: string; day: string; month: string } => ({
  weekday: at(d).toLocaleDateString(undefined, { weekday: 'short' }),
  day: at(d).toLocaleDateString(undefined, { day: 'numeric' }),
  month: at(d).toLocaleDateString(undefined, { month: 'short' })
});
/* The year is shown only where nothing around it already says it, and only when it isn't this year:
 * a band header (Year / Month / Week) carries it for banded table rows, so the row itself stays bare. */
export const isPastYear = (d: string): boolean => d.slice(0, 4) !== String(new Date().getFullYear());
export const longDate = (d: string): string =>
  at(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(isPastYear(d) && { year: 'numeric' }) });
/** 'Fri' and 'Sep 9'. */
export const weekdayShort = (d: string): string => at(d).toLocaleDateString(undefined, { weekday: 'short' });
export const dateCell = (d: string): string => `${at(d).toLocaleDateString(undefined, { month: 'short' })} ${+d.slice(8, 10)}`;
export const shortDate = (d: string): string =>
  at(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export { toHHMM };

/** 'Sep 20 – 26', the calendar week (Sunday start) that contains d. */
export const weekLabel = (d: string): string => {
  const a = weekStart(d), b = addDays(a, 6);
  const same = a.slice(0, 7) === b.slice(0, 7);
  return `${shortDate(a)} – ${same ? at(b).toLocaleDateString(undefined, { day: 'numeric' }) : shortDate(b)}, ${b.slice(0, 4)}`;
};
