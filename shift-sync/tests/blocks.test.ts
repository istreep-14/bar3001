import test from 'node:test';
import assert from 'node:assert/strict';
import type { Income, Shift } from '../src/core/core.generated.js';
import { bySource, dailyValues, levelScale, weekColumns, incomeByWeek, nextShift, rateHeat, runningMonth, shares, sourcesIn, weekAgenda, weekPeople } from '../src/lib/blocks.ts';
import type { Crew } from '../src/core/core.generated.js';
import { hoursWorked } from '../src/core/core.generated.js';
import { toView } from '../src/lib/stats.ts';
import { smoothPath } from '../src/ui/smooth.ts';

const shift = (o: Partial<Shift> = {}): Shift => ({ id: 'a', date: '2026-09-25', start: 1080, end: 1440, tips: 300, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false, ...o });
const inc = (o: Partial<Income> = {}): Income => ({ id: 'i', shift_id: 'a', category: 'Venmo', amount: 40, note: null, updated_at: 1, deleted: false, ...o });
const RATES = [{ date: '2026-01-01', rate: 5 }];
const TODAY = '2026-10-02';   // a Friday; its week starts Monday 2026-09-28

test('income by week stacks tips, wage and each source, oldest week first, and skips shifts still waiting', () => {
  const views = [
    toView(shift({ id: 'a', date: '2026-09-25' }), [inc({ amount: 40 })], [], RATES),               // last week: 300 + 30 wage + 40 Venmo
    toView(shift({ id: 'b', date: '2026-09-29', tips: 200 }), [], [], RATES),                        // this week: 200 + 30 wage
    toView(shift({ id: 'c', date: '2026-09-30', tips: null }), [], [], RATES)   // clocked out, waiting on tips: counts nothing
  ];
  const weeks = incomeByWeek(views, TODAY, 2);
  assert.deepEqual(weeks.map(w => w.key), ['2026-09-21', '2026-09-28']);
  assert.deepEqual(weeks[0]!.by, { Tips: 300, Wage: 30, Venmo: 40 });
  assert.equal(weeks[0]!.total, 370);
  assert.equal(weeks[1]!.partial, true);
  assert.equal(weeks[1]!.n, 1);
  assert.deepEqual(sourcesIn(weeks), ['Tips', 'Wage', 'Venmo']);
});

test('the heatmap has a row per weekday and a column per week, with no rate on a day without money in', () => {
  const views = [toView(shift({ id: 'a', date: '2026-09-25', tips: 360 }), [], [], RATES)];   // Fri, 6h, $60/h
  const h = rateHeat(views, TODAY, 2);
  assert.deepEqual(h.weeks, ['2026-09-21', '2026-09-28']);
  assert.equal(h.rows.length, 7);
  assert.equal(h.rows[4]![0]!.date, '2026-09-25');
  assert.equal(h.rows[4]![0]!.tph, 60);
  assert.equal(h.rows[0]![0]!.tph, null);
  assert.equal(h.rows[6]![1]!.future, true);   // Sunday Oct 4 is still to come
  assert.equal(h.max, 60);
});

test('the running month stops at today and the month before is carried to the same day numbers', () => {
  const views = [
    toView(shift({ id: 'a', date: '2026-10-01', tips: 100 }), [], [], []),
    toView(shift({ id: 'b', date: '2026-09-02', tips: 50 }), [], [], []),
    toView(shift({ id: 'c', date: '2026-09-30', tips: 70 }), [], [], [])
  ];
  const r = runningMonth(views, TODAY, v => v.shift.tips ?? 0);
  assert.equal(r.days, 31);
  assert.deepEqual(r.now.slice(0, 3), [100, 100, null]);
  assert.equal(r.prev[0], 0);
  assert.equal(r.prev[1], 50);
  assert.equal(r.prev[29], 120);
  assert.equal(r.prev[30], 120);   // September has 30 days: its total carries to the 31st
});

test('the agenda is seven days from Monday, marking past, today and ahead, earliest start first', () => {
  const views = [
    toView(shift({ id: 'late', date: TODAY, start: 1200 }), [], [], []),
    toView(shift({ id: 'early', date: TODAY, start: 660 }), [], [], []),
    toView(shift({ id: 'soon', date: '2026-10-03', tips: null, end: null }), [], [], [])
  ];
  const days = weekAgenda(views, TODAY);
  assert.equal(days.length, 7);
  assert.equal(days[0]!.date, '2026-09-28');
  assert.deepEqual(days.map(d => d.when), ['past', 'past', 'past', 'past', 'today', 'ahead', 'ahead']);
  assert.deepEqual(days[4]!.views.map(v => v.shift.id), ['early', 'late']);
  assert.equal(nextShift(views, TODAY)?.shift.id, 'soon');
});

test('shares add up to exactly 100', () => {
  assert.deepEqual(shares([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(shares([0, 0]), [0, 0]);
  assert.equal(shares([12.3, 45.6, 7.1, 3]).reduce((t, n) => t + n, 0), 100);
});

test('a smooth path passes through every point and never overshoots a flat run', () => {
  const d = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
  assert.ok(d.startsWith('M0,10'));
  assert.ok(d.includes(' 10,10') && d.includes(' 20,0') && d.endsWith(' 30,0'));
  // the flat stretch from 0 to 10 stays exactly flat: both control points sit at y = 10
  assert.ok(d.includes('C3.33,10 6.67,10 10,10'));
  assert.equal(smoothPath([]), '');
});

test('a day splits by source, and the week\'s people are one row each with their own times, you first', () => {
  const crew = (o: Partial<Crew>): Crew => ({ id: 'c', shift_id: 'a', staff_id: 'p1', name: 'Dev', start: 1080, end: 1440, location: 'Main', updated_at: 1, deleted: false, ...o });
  const a = toView(shift({ id: 'a', date: '2026-09-28' }), [inc({ amount: 25 })], [crew({}), crew({ id: 'c2', staff_id: 'me', name: 'Ian', start: 1140 })], RATES);
  const b = toView(shift({ id: 'b', date: '2026-09-29' }), [], [crew({ id: 'c3', shift_id: 'b', end: 1320 })], RATES);
  assert.deepEqual(bySource([a]), { Tips: 300, Wage: 30, Venmo: 25 });
  const people = weekPeople(weekAgenda([a, b], TODAY), id => id === 'me', hoursWorked);
  assert.deepEqual(people.map(p => p.name), ['Ian', 'Dev']);
  assert.equal(people[1]!.days.length, 2);
  assert.equal(people[1]!.hours, 10);
});

test('daily values cover every day, empty days null, waiting days marked', () => {
  const views = [
    toView(shift({ id: 'a', date: '2026-09-28', tips: 200 }), [], [], []),
    toView(shift({ id: 'b', date: '2026-09-30', tips: null, end: null }), [], [], [])
  ];
  const days = dailyValues(views, '2026-09-28', '2026-09-30', 'tips');
  assert.deepEqual(days.map(d => [d.date, d.value, d.pending]), [['2026-09-28', 200, false], ['2026-09-29', null, false], ['2026-09-30', null, true]]);
  assert.equal(dailyValues(views, '2026-09-28', '2026-09-28', 'hours')[0]!.value, 6);
});

test('levels split by quartile and the week columns end on the week holding the date', () => {
  const lv = levelScale([10, 20, 30, 40, 50, 60, 70, 80, null]);
  assert.deepEqual([null, 0, 10, 30, 50, 80].map(lv), [0, 0, 1, 2, 3, 4]);
  assert.equal(levelScale([5])(5), 2);
  assert.deepEqual(weekColumns(TODAY, 3), ['2026-09-14', '2026-09-21', '2026-09-28']);
});
