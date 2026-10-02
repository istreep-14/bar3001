import { signal } from '@preact/signals';
import { oneOf, persisted } from '../../data/persisted.ts';
import { GROUP_BYS } from '../../lib/groups.ts';
import type { GroupBy } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import type { Tier } from '../../ui/useWidth.ts';

/* Shifts views, in tab order. The choice is remembered; opening the drawer does not clear it. */
export const SHIFT_VIEW_IDS = ['overview', 'pay', 'weeks', 'time', 'staffing', 'sheet'] as const;
export type ShiftViewId = (typeof SHIFT_VIEW_IDS)[number];
export const SHIFT_TABS: { value: ShiftViewId; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'pay', label: 'Pay' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'time', label: 'Time' },
  { value: 'staffing', label: 'Staffing' },
  { value: 'sheet', label: 'Sheet' }
];
export const [shiftsView, setShiftsView] = persisted<ShiftViewId>('shifts-view', oneOf(SHIFT_VIEW_IDS), 'overview');

/** None, week or month. Shared by Overview, Pay, Time, Staffing and Sheet. */
export const [groupBy, setGroupBy] = persisted<GroupBy>('table-group', oneOf(GROUP_BYS.map(g => g.id)), 'none');

/** Weeks rolls up by week or by month, separate from the shared Group switcher. */
export const [weekRollup, setWeekRollup] = persisted<'week' | 'month'>('table-rollup', oneOf(['week', 'month'] as const), 'week');

/** Set when a Weeks row is opened: Overview groups to that period and shows just that band. */
export const bandFocus = signal<string | null>(null);

/** Sheet columns the device has hidden. '' means the default (none, or the phone set when the sheet is narrow).
 *  '-' means the person chose to show every column. */
export const [sheetHiddenRaw, setSheetHiddenRaw] = persisted<string>('table-sheet-hidden', (v): v is string => typeof v === 'string', '');

export const SHEET_PHONE_HIDDEN = ['weekday', 'party', 'wage', 'other', 'perHour', 'stations'];

export interface SheetCtx {
  /** Searched and filtered, still inside the period. */
  rows: ShiftView[];
  /** The period, before search and filters. The "of M" count. */
  all: ShiftView[];
  by: GroupBy;
  tier: Tier;
  /** The sheet's own width in rem, null before the first measure. */
  rem: number | null;
}
