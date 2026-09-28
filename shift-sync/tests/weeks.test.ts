import test from 'node:test';
import assert from 'node:assert/strict';
import type { Shift } from '../src/core/core.generated.js';
import { monthGrid } from '../src/lib/calendar.ts';
import { weekCompare } from '../src/lib/dashboard.ts';
import { WEEK_START, addDays, weekStart, weekday } from '../src/lib/dates.ts';
import { groupShifts } from '../src/lib/groups.ts';
import { toView } from '../src/lib/stats.ts';
import { summaryRows } from '../src/lib/summary.ts';

/* One week for the whole app. The Log's week groups, Totals' week rows, the Dashboard's week and the calendar's rows
 * once disagreed (Sunday here, Monday there), so "this week" meant two different weeks on two pages. */
const shift = (date: string): Shift => ({ id: date, date, start: 1080, end: 120, tips: 200, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false });

test('the app week is Monday to Sunday', () => {
  assert.equal(WEEK_START, 1);
  assert.equal(weekday(weekStart('2026-09-27')), 1);
});

test('every page puts a day in the same week', () => {
  for (let i = 0; i < 21; i++) {
    const d = addDays('2026-09-14', i), v = toView(shift(d), []);
    const want = weekStart(d);
    assert.equal(groupShifts([v], 'week')[0]!.key, want, `Log ${d}`);
    assert.equal(summaryRows([v], 'week')[0]!.key, want, `Totals ${d}`);
    assert.equal(weekCompare([v], d).start, want, `Dashboard ${d}`);
    const grid = monthGrid(+d.slice(0, 4), +d.slice(5, 7) - 1);
    const row = Math.floor(grid.findIndex(c => c.date === d) / 7);
    assert.equal(grid[row * 7]!.date, want, `Calendar ${d}`);
  }
});
