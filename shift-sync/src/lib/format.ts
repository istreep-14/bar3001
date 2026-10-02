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
/** A rate: '$12.40/hr', two decimals like all money, or a dash when there is none. Every rate the app shows is this (or,
 *  where the unit already sits beside it, in a column head or its own small span, `money` of the same figure), so a
 *  rate reads the same on every page. */
export const perHour = (n: number | null | undefined): string => (n == null ? DASH : `${money2.format(n)}/hr`);
/** Whole dollars an hour, only where two decimals cannot fit (a calendar day's chip): '$12/hr'. */
export const perHourWhole = (n: number | null | undefined): string => (n == null ? DASH : `${money0.format(n)}/hr`);

export const hours = (h: number | null | undefined): string => (h == null ? DASH : `${+h.toFixed(1)}h`);
/** The same figure with no unit, for where the unit is already plain (the Log's clock ring, under an Hours head): 8, 6.5. */
export const hoursBare = (h: number | null | undefined): string => (h == null ? DASH : `${+h.toFixed(1)}`);

/** Exact and fixed-width ('06:00 PM'), so every time has the same digits and lines up. */
export const clock = (min: number | null): string => {
  if (min == null) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
/** Table form: 'h:mm' plus a/p, no leading zero ('6:00p', '1:15a'). The full time is in the cell's tooltip. */
export const clockShort = (min: number | null): string =>
  min == null ? '' : `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, '0')}${min < 720 ? 'a' : 'p'}`;
/** Tightest form, for a time tag: the minutes only when there are any ('6p', '5:30p', '12a'). */
export const clockTight = (min: number | null): string =>
  min == null ? '' : `${Math.floor(min / 60) % 12 || 12}${min % 60 ? ':' + String(min % 60).padStart(2, '0') : ''}${min < 720 ? 'a' : 'p'}`;
/** A time in two parts for a column of times: the hour padded to two digits' width with a figure space (' 6:00', '11:30'),
 *  so with even-width digits the colons line up down the column, and the half of the day ('AM'/'PM') to set smaller after it. */
export const clockParts = (min: number): { hm: string; ap: 'AM' | 'PM' } => ({
  hm: `${String(Math.floor(min / 60) % 12 || 12).padStart(2, '\u2007')}:${String(min % 60).padStart(2, '0')}`,
  ap: min < 720 ? 'AM' : 'PM'
});
/** Reading form: '6:00 PM', '12:15 AM'. No leading zero and never 24-hour; for rows where times sit in a sentence-like cell. */
export const clockPlain = (min: number | null): string =>
  min == null ? '' : `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, '0')} ${min < 720 ? 'AM' : 'PM'}`;

/** One decimal for hours in tables: 8.2, 9.5. */
export const dec1 = (n: number | null | undefined): string => (n == null ? DASH : n.toFixed(1));

/** Whole numbers for table cells: hours, income, rates. Exact figures live in the drawer. */
export const int = (n: number | null | undefined): string =>
  n == null ? DASH : Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const at = (d: string) => new Date(d + 'T12:00:00');

/* Month and weekday names in this device's language, like every date around them. Weekdays run Monday first: the order of
 * `weekdayIndex` and of the app's weeks (`WEEK_START`). Every list, key and calendar head that names them reads these. */
const names = (dates: string[], o: Intl.DateTimeFormatOptions) => dates.map(d => at(d).toLocaleDateString(undefined, o));
const months = Array.from({ length: 12 }, (_, m) => `2024-${String(m + 1).padStart(2, '0')}-15`);
const week = Array.from({ length: 7 }, (_, i) => addDays('2024-01-01', i));   // 2024-01-01 was a Monday
export const MONTH_NAMES = names(months, { month: 'long' });
export const MONTH_SHORT = names(months, { month: 'short' });
export const WEEKDAY_NAMES = names(week, { weekday: 'long' });
export const WEEKDAY_SHORT = names(week, { weekday: 'short' });
export const WEEKDAY_LETTERS = names(week, { weekday: 'narrow' });
export const dayLabel = (d: string): { weekday: string; day: string; month: string } => ({
  weekday: at(d).toLocaleDateString(undefined, { weekday: 'long' }),
  day: at(d).toLocaleDateString(undefined, { day: 'numeric' }),
  month: at(d).toLocaleDateString(undefined, { month: 'short' })
});
/* The year is shown only where nothing around it already says it, and only when it isn't this year:
 * a band header (Year / Month / Week) carries it for banded table rows, so the row itself stays bare. */
export const isPastYear = (d: string): boolean => d.slice(0, 4) !== String(new Date().getFullYear());
/** '’24' next to a date that would otherwise read as ambiguous once it's off its own band (a card scrolled
 *  away from its month heading); null in the current year, where the ambiguity doesn't exist. */
export const yearTag = (d: string): string | null => (isPastYear(d) ? `’${d.slice(2, 4)}` : null);
export const longDate = (d: string): string =>
  at(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(isPastYear(d) && { year: 'numeric' }) });
/** Always carries the year, for a hover title where there's no band or year tag nearby to lean on. */
export const fullDate = (d: string): string =>
  at(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
/** 'Fri' and 'Sep 9'. */
export const weekdayShort = (d: string): string => at(d).toLocaleDateString(undefined, { weekday: 'short' });
export const dateCell = (d: string): string => `${at(d).toLocaleDateString(undefined, { month: 'short' })} ${+d.slice(8, 10)}`;
export const shortDate = (d: string): string =>
  at(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export { toHHMM };

const longMonthDay = (d: string): string => at(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

/** 'September 21 – 27, 2026', the calendar week (Monday to Sunday) that contains d. */
export const weekLabel = (d: string): string => {
  const a = weekStart(d), b = addDays(a, 6);
  const same = a.slice(0, 7) === b.slice(0, 7);
  return `${longMonthDay(a)} – ${same ? at(b).toLocaleDateString(undefined, { day: 'numeric' }) : longMonthDay(b)}, ${b.slice(0, 4)}`;
};

/** A band's short name for the week (Monday to Sunday) that contains d, short enough for a day column: 'Sep 21 – 27',
 *  or 'Sep 28 – Oct 4' when it runs into the next month. The year is the band title's job (`weekLabel`). */
export const weekShort = (d: string): string => {
  const a = weekStart(d), b = addDays(a, 6);
  return `${shortDate(a)} – ${a.slice(0, 7) === b.slice(0, 7) ? String(+b.slice(8, 10)) : shortDate(b)}`;
};
/** A band's short name for a month ('2026-09' or any date in it): 'September', with the year only when it is not this
 *  year ('September 2025'). The full 'September 2026' goes in the band's title. */
export const monthShort = (key: string): string => {
  const d = key.slice(0, 7) + '-15';
  return at(d).toLocaleDateString(undefined, isPastYear(d) ? { month: 'long', year: 'numeric' } : { month: 'long' });
};
