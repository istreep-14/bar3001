import { CATEGORIES } from '../core/core.generated.js';
import type { Category } from '../core/core.generated.js';
import type { ShiftView } from './stats.ts';

/* Every money line on a shift, one row each: its Tips, its estimated Wage, each Other income line, and a legacy
 * `shift.other` as 'Earlier entry'. The Income page lists them, and the rail's Income count counts them, by this one
 * rule, so the two always agree (estimated wage lines included). Pure. */
export type MoneyKind = 'Tips' | 'Wage' | 'Other';
export const MONEY_KINDS: MoneyKind[] = ['Tips', 'Wage', 'Other'];

export interface MoneyLine {
  id: string;
  v: ShiftView;
  /** Tips, Wage (estimated from hours and the hourly wage) or Other. */
  category: MoneyKind;
  /** An Other line's source (Chump, Cash, …, or 'Other' for an earlier entry); null for Tips and Wage. */
  type: Category | 'Other' | null;
  amount: number;
  note: string;
}

/** Where a source sorts: the CATEGORIES order, an earlier entry last. */
export const sourceOrder = (c: Category | 'Other'): number => (c === 'Other' ? 99 : CATEGORIES.indexOf(c));

/** A shift's money lines, Tips then Wage then each source in CATEGORIES order (larger first within one), then an
 *  earlier entry. A shift with nothing logged yet has none, except an estimated wage once it has hours. */
export function moneyLines(v: ShiftView): MoneyLine[] {
  const out: MoneyLine[] = [];
  const sid = v.shift.id;
  if (v.shift.tips != null) out.push({ id: `${sid}:tips`, v, category: 'Tips', type: null, amount: v.shift.tips, note: '' });
  if (v.wage != null) out.push({ id: `${sid}:wage`, v, category: 'Wage', type: null, amount: v.wage, note: '' });
  for (const line of [...v.income].sort((a, b) => sourceOrder(a.category) - sourceOrder(b.category) || b.amount - a.amount)) {
    out.push({ id: line.id, v, category: 'Other', type: line.category, amount: line.amount, note: line.note ?? '' });
  }
  if (v.shift.other) out.push({ id: `${sid}:other`, v, category: 'Other', type: 'Other', amount: v.shift.other, note: 'Earlier entry' });
  return out;
}

/** How many money lines a set of shifts has: the Income page's 'of M' and the rail's Income count. */
export const countMoneyLines = (views: ShiftView[]): number => views.reduce((n, v) => n + moneyLines(v).length, 0);
