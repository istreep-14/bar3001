import { CATEGORIES } from '../core/core.generated.js';
import type { Category } from '../core/core.generated.js';
import { monthKey, weekStart } from './dates.ts';
import { weekLabel } from './format.ts';
import type { ShiftView } from './stats.ts';

/* How the Log groups its rows. A group names its month or week once (the band), and the rows under it only say
 * the day. The band carries a count and the group's total and nothing else: per-column sums crowded it. Pure. */
export type GroupBy = 'month' | 'week' | 'none';
export const GROUP_BYS: { id: GroupBy; label: string }[] = [
  { id: 'month', label: 'By month' }, { id: 'week', label: 'By week' }, { id: 'none', label: 'Flat' }
];

/** A shift still waiting on its money: no tips and no other income yet (logged ahead of time, or tips not in). */
export const isPending = (v: ShiftView): boolean => v.shift.tips == null && v.income.length === 0 && !v.shift.other;

export interface ShiftGroup {
  key: string;
  /** 'September 2026' or 'Sep 20 – 26, 2026'; empty for the single Flat group. */
  label: string;
  views: ShiftView[];
  /** Shifts with their money in, and ones still waiting on it. */
  done: number;
  pending: number;
  /** Everything earned across the done shifts: tips, other income and estimated wage. */
  total: number;
}

const monthLabel = (key: string): string =>
  new Date(key + '-01T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Groups views in the order they arrive (newest first from the store), one group per month or week. */
export function groupShifts(views: ShiftView[], by: GroupBy): ShiftGroup[] {
  const keyOf = (v: ShiftView) => (by === 'month' ? monthKey(v.shift.date) : by === 'week' ? weekStart(v.shift.date) : 'all');
  const out: ShiftGroup[] = [];
  for (const v of views) {
    const key = keyOf(v);
    let g = out.find(x => x.key === key);
    if (!g) {
      g = { key, label: by === 'month' ? monthLabel(key) : by === 'week' ? weekLabel(key) : '', views: [], done: 0, pending: 0, total: 0 };
      out.push(g);
    }
    g.views.push(v);
    if (isPending(v)) g.pending++;
    else { g.done++; g.total += v.total; }
  }
  return out;
}

/** 'Fri 25' inside a group (the band already says the month); 'Fri Sep 25' when flat. */
export const rowDay = (d: string, by: GroupBy): string => {
  const at = new Date(d + 'T12:00:00');
  const wd = at.toLocaleDateString(undefined, { weekday: 'short' });
  return by === 'none' ? `${wd} ${at.toLocaleDateString(undefined, { month: 'short' })} ${+d.slice(8, 10)}` : `${wd} ${+d.slice(8, 10)}`;
};

/** One piece of a shift's total. `token` is the CSS custom property its colour comes from. */
export interface IncomePart { key: string; label: string; amount: number; token: string; estimated?: boolean }

/** What a total is made of, in a fixed order (tips, wage, then each income source), zeros left out. Takes the raw
 *  pieces so the form can show it for a shift that isn't saved yet. */
export function partsOf(tips: number | null, wage: number | null, lines: { category: Category; amount: number }[], other: number | null): IncomePart[] {
  const parts: IncomePart[] = [];
  if (tips) parts.push({ key: 'tips', label: 'Tips', amount: tips, token: '--cat-tips' });
  if (wage) parts.push({ key: 'wage', label: 'Wage', amount: wage, token: '--cat-wage', estimated: true });
  for (const c of CATEGORIES) {
    const amount = lines.filter(i => i.category === c).reduce((t, i) => t + i.amount, 0);
    if (amount) parts.push({ key: c, label: c, amount, token: `--cat-${c.toLowerCase()}` });
  }
  if (other) parts.push({ key: 'other', label: 'Other', amount: other, token: '--cat-other' });
  return parts;
}

/** A saved shift's parts. They always add up to the view's total. */
export const incomeParts = (v: ShiftView): IncomePart[] => partsOf(v.shift.tips, v.wage, v.income, v.shift.other);
