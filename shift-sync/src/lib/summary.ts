import { addDays, weekStart } from './dates.ts';
import { weekdayIndex } from './periods.ts';
import { summarize } from './stats.ts';
import type { ShiftView, Summary } from './stats.ts';

/* The Summary page's rows: the same shifts the Log lists, folded into groups with every column summed. Time groups are
 * newest first and know the group before them (for a change indicator); the others are in their natural order. */
export type By = 'week' | 'month' | 'year' | 'weekday' | 'type' | 'party';
export const BYS: { id: By; label: string }[] = [
  { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' },
  { id: 'weekday', label: 'Weekday' }, { id: 'type', label: 'Type' }, { id: 'party', label: 'Party' }
];
export interface SumRow { key: string; views: ShiftView[]; s: Summary; /** The group just before this one in time (time groups only). */ prev: Summary | null }

const KEY: Record<By, (v: ShiftView) => string> = {
  week: v => weekStart(v.shift.date),
  month: v => v.shift.date.slice(0, 7),
  year: v => v.shift.date.slice(0, 4),
  weekday: v => String(weekdayIndex(v.shift.date)),
  type: v => v.shift.shift_type ?? 'none',
  party: v => (v.shift.party ? 'party' : 'none')
};
export const isTime = (by: By): boolean => by === 'week' || by === 'month' || by === 'year';

export function summaryRows(views: ShiftView[], by: By): SumRow[] {
  const map = new Map<string, ShiftView[]>();
  for (const v of views) { const k = KEY[by](v); map.set(k, [...(map.get(k) ?? []), v]); }
  let keys = [...map.keys()].sort();
  if (isTime(by)) keys.reverse();
  else if (by === 'weekday') keys = keys.sort((a, b) => +a - +b);
  const rows = keys.map(key => ({ key, views: map.get(key)!, s: summarize(map.get(key)!), prev: null as Summary | null }));
  if (isTime(by)) {
    // a week or month with no shifts in it still sits between its neighbours in time, so compare against the previous *calendar* step
    for (let i = 0; i < rows.length; i++) {
      const want = previousKey(rows[i]!.key, by);
      const before = rows.find(r => r.key === want);
      rows[i]!.prev = before ? before.s : null;
    }
  }
  return rows;
}

const previousKey = (key: string, by: By): string => {
  if (by === 'week') return addDays(key, -7);
  if (by === 'year') return String(+key - 1);
  const y = +key.slice(0, 4), m = +key.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
