import test from 'node:test';
import assert from 'node:assert/strict';
import type { Income, Shift } from '../src/core/core.generated.js';
import { addDays, daysBetween, weekStart } from '../src/lib/dates.ts';
import { groupByWeek, rateTone, summarize, toView } from '../src/lib/stats.ts';
import { addMonths, applyScope, clampN, labelOf, sameScope, startOf } from '../src/lib/scope.ts';
import type { Scope } from '../src/lib/scope.ts';

const shift = (o: Partial<Shift> = {}): Shift => ({ id: 'a', date: '2026-09-25', start: 1080, end: 120, tips: 240, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false, ...o });
const inc = (o: Partial<Income> = {}): Income => ({ id: 'i', shift_id: 'a', category: 'Cash', amount: 40, note: null, updated_at: 1, deleted: false, ...o });

test('date math is timezone-safe across month and year ends', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-09-18', '2026-09-25'), 7);
  assert.equal(weekStart('2026-09-25'), '2026-09-20'); // Friday -> previous Sunday
  assert.equal(weekStart('2026-09-20'), '2026-09-20');
});

test('view derives hours, tips/hr and total incl. income lines and legacy other', () => {
  const v = toView(shift({ other: 10 }), [inc({ amount: 40 }), inc({ id: 'j', category: 'Venmo', amount: 5 })]);
  assert.equal(v.hours, 8);
  assert.equal(v.tph, 30);
  assert.equal(v.extra, 55);
  assert.equal(v.total, 295);
});

test('summary tips/hr only counts shifts that have hours and tips', () => {
  const a = toView(shift(), []);                                   // 240 over 8h
  const b = toView(shift({ id: 'b', start: null, end: null, tips: 100 }), []);   // no hours
  const s = summarize([a, b]);
  assert.equal(s.tips, 340);
  assert.equal(s.tph, 30);
  assert.equal(s.hours, 8);
  assert.equal(summarize([]).tph, null);
});

test('rate tone is relative to the scope average, neutral within 20%', () => {
  assert.equal(rateTone(40, 30), 'good');
  assert.equal(rateTone(20, 30), 'bad');
  assert.equal(rateTone(35, 30), null);
  assert.equal(rateTone(null, 30), null);
});

const at = (id: string, date: string) => toView(shift({ id, date }), []);
const T = '2026-09-25';

test('month math clamps the day: Mar 31 minus one month is Feb 28', () => {
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2024-03-31', -1), '2024-02-29');
  assert.equal(addMonths('2026-01-15', -2), '2025-11-15');
  assert.equal(addMonths('2026-12-31', 2), '2027-02-28');
});

test('last N days/weeks/months/years: today is day one, start is inclusive', () => {
  assert.equal(startOf(7, 'days', T), '2026-09-19');
  assert.equal(startOf(1, 'days', T), T);
  assert.equal(startOf(2, 'weeks', T), '2026-09-12');
  assert.equal(startOf(1, 'months', T), '2026-08-26');
  assert.equal(startOf(3, 'months', '2026-05-31'), '2026-03-01');
  assert.equal(startOf(1, 'years', T), '2025-09-26');
});

test('applying a scope: days, shifts, range, all', () => {
  const vs = ['2026-09-25', '2026-09-19', '2026-09-18', '2026-08-01', '2026-10-02'].map((d, i) => at('s' + i, d));
  const ids = (s: Scope) => applyScope(vs, s, T).map(v => v.shift.id);
  assert.deepEqual(ids({ mode: 'last', n: 7, unit: 'days' }), ['s0', 's1', 's4']);        // 09-18 is the 8th day back; a future-dated shift still shows
  assert.deepEqual(ids({ mode: 'last', n: 2, unit: 'shifts' }), ['s4', 's0']);            // the two most recent by date
  assert.deepEqual(ids({ mode: 'range', from: '2026-08-01', to: '2026-09-18' }), ['s2', 's3']);
  assert.deepEqual(ids({ mode: 'all' }), ['s0', 's1', 's2', 's3', 's4']);
});

test('labels, equality, and input clamping', () => {
  assert.equal(labelOf({ mode: 'all' }, T), 'All time');
  assert.equal(labelOf({ mode: 'last', n: 1, unit: 'shifts' }, T), 'Latest 1 shift');
  assert.equal(labelOf({ mode: 'last', n: 20, unit: 'shifts' }, T), 'Latest 20 shifts');
  assert.equal(sameScope({ mode: 'last', n: 30, unit: 'days' }, { mode: 'last', n: 30, unit: 'days' }), true);
  assert.equal(sameScope({ mode: 'last', n: 30, unit: 'days' }, { mode: 'last', n: 30, unit: 'weeks' }), false);
  assert.equal(clampN(0), null);
  assert.equal(clampN(NaN), null);
  assert.equal(clampN(12.9), 12);
  assert.equal(clampN(5000), 999);
});

test('weeks group newest-first views and total each week', () => {
  const vs = [toView(shift({ id: 'a', date: '2026-09-25' }), []), toView(shift({ id: 'b', date: '2026-09-21', tips: 60 }), []), toView(shift({ id: 'c', date: '2026-09-13', tips: 10 }), [])];
  const w = groupByWeek(vs);
  assert.deepEqual(w.map(x => [x.start, x.views.length, x.summary.total]), [['2026-09-20', 2, 300], ['2026-09-13', 1, 10]]);
});

test('a shift view counts its bartenders and adds up their hours, blanks excluded from hours', () => {
  const crew = [
    { id: 'c1', shift_id: 'a', staff_id: 'me', name: 'Ian', start: 1080, end: 120, updated_at: 1, deleted: false },
    { id: 'c2', shift_id: 'a', staff_id: 'p1', name: 'Abby', start: 1020, end: 60, updated_at: 1, deleted: false },
    { id: 'c3', shift_id: 'a', staff_id: 'p2', name: 'Allen', start: null, end: null, updated_at: 1, deleted: false }
  ];
  const v = toView(shift(), [], crew);
  assert.equal(v.crewCount, 3);
  assert.equal(v.crewHours, 8 + 8);
  assert.equal(summarize([v, toView(shift({ id: 'b' }), [])]).crewHours, 16);
  assert.equal(toView(shift(), []).crewCount, 0);
});

test('wage: estimated from hours and the rate in effect that day, counted in the total, never in tips per hour', () => {
  const rates = [{ date: '2024-10-23', rate: 5 }, { date: '2026-05-17', rate: 7 }];
  const before = toView(shift({ date: '2026-05-16', tips: 240 }), [], [], rates);     // 8h at $5
  const after = toView(shift({ date: '2026-05-17', tips: 240 }), [], [], rates);      // 8h at $7
  assert.equal(before.wage, 40);
  assert.equal(after.wage, 56);
  assert.equal(after.total, 240 + 56);
  assert.equal(after.tph, 30);                                                       // tips only
  assert.equal(after.extra, 0);                                                      // wage is not "other income"
  const none = toView(shift({ start: null, end: null }), [], [], rates);
  assert.equal(none.wage, null);
  assert.equal(toView(shift(), []).wage, null);
  const s = summarize([before, after]);
  assert.deepEqual([s.wage, s.total, s.tips], [96, 480 + 96, 480]);
});

test('total per hour: everything earned over hours; tips per hour is untouched by wage and other income', () => {
  const rates = [{ date: '2024-10-23', rate: 7 }];
  const v = toView(shift({ tips: 240, other: 10 }), [inc({ amount: 30 })], [], rates);   // 8h: 240 + 10 + 30 + 56 = 336
  assert.equal(v.total, 336);
  assert.equal(v.perHour, 42);
  assert.equal(v.tph, 30);
  assert.equal(toView(shift({ start: null, end: null }), []).perHour, null);
  const s = summarize([v, toView(shift({ id: 'b', tips: 80 }), [], [], rates)]);          // (336 + 136) over 16h
  assert.equal(s.perHour, 472 / 16);
});

/* ── Overview and calendar helpers ── */
import { groupBy, mondayOf, niceScale, periods, scopeBounds, weekdayIndex } from '../src/lib/periods.ts';
import { heat, monthGrid } from '../src/lib/calendar.ts';

test('weeks run Monday to Sunday', () => {
  assert.equal(mondayOf('2026-09-25'), '2026-09-21');   // Fri
  assert.equal(mondayOf('2026-09-27'), '2026-09-21');   // Sun belongs to the week that began Monday
  assert.equal(mondayOf('2026-09-28'), '2026-09-28');
  assert.deepEqual(['2026-09-21', '2026-09-27'].map(weekdayIndex), [0, 6]);
});

test('periods: weekly for a short range, monthly for a long one, empty periods kept, sums add up', () => {
  const vs = [toView(shift({ id: 'a', date: '2026-09-21', tips: 100 }), []), toView(shift({ id: 'b', date: '2026-09-27', tips: 50 }), []), toView(shift({ id: 'c', date: '2026-10-06', tips: 10 }), [])];
  const w = periods(vs, '2026-09-21', '2026-10-11');
  assert.equal(w.monthly, false);
  assert.deepEqual(w.buckets.map(b => [b.key, b.n, b.tips]), [['2026-09-21', 2, 150], ['2026-09-28', 0, 0], ['2026-10-05', 1, 10]]);
  assert.equal(w.buckets[0]!.hours, 16);                       // two 8h shifts
  const m = periods(vs, '2025-01-01', '2026-10-31');
  assert.equal(m.monthly, true);
  assert.equal(m.buckets.length, 22);
  assert.deepEqual(m.buckets.filter(b => b.n).map(b => [b.key, b.tips]), [['2026-09', 150], ['2026-10', 10]]);
});

test('scope bounds resolve every scope to first and last date', () => {
  const vs = [toView(shift({ id: 'a', date: '2026-08-01' }), []), toView(shift({ id: 'b', date: '2026-09-01' }), []), toView(shift({ id: 'c', date: '2026-09-10' }), [])];
  const T = '2026-09-25';
  assert.deepEqual(scopeBounds({ mode: 'all' }, vs, T), { from: '2026-08-01', to: T });
  assert.deepEqual(scopeBounds({ mode: 'last', n: 2, unit: 'shifts' }, vs, T), { from: '2026-09-01', to: T });
  assert.deepEqual(scopeBounds({ mode: 'range', from: '2026-01-01', to: '2026-02-01' }, vs, T), { from: '2026-01-01', to: '2026-02-01' });
  assert.equal(scopeBounds({ mode: 'last', n: 7, unit: 'days' }, vs, T).to, T);
});

test('groupBy keeps the order asked for and summarizes each group; tips per hour stays tips only', () => {
  const day = toView(shift({ id: 'a', shift_type: 'day', tips: 160, start: 600, end: 1080 }), [inc({ amount: 900 })]);   // 8h, 20/hr tips; big other income
  const night = toView(shift({ id: 'b', shift_type: 'night', tips: 80 }), []);                                            // 8h, 10/hr
  const g = groupBy([night, day], [{ key: 'day', label: 'Day' }, { key: 'night', label: 'Night' }], v => v.shift.shift_type ?? '');
  assert.deepEqual(g.map(x => [x.label, x.s.shifts, x.s.tph]), [['Day', 1, 20], ['Night', 1, 10]]);
});

test('niceScale gives round axis steps', () => {
  assert.deepEqual(niceScale(178), { top: 200, ticks: [0, 50, 100, 150, 200] });
  assert.deepEqual(niceScale(7993).ticks, [0, 2000, 4000, 6000, 8000]);
  assert.deepEqual(niceScale(0), { top: 1, ticks: [0, 1] });
});

test('month grid: whole Monday-first weeks, neighbours marked as outside the month', () => {
  const g = monthGrid(2026, 8);                                  // September 2026 starts on a Tuesday
  assert.equal(g.length % 7, 0);
  assert.equal(g[0]!.date, '2026-08-31');
  assert.equal(g[0]!.inMonth, false);
  assert.equal(g.filter(c => c.inMonth).length, 30);
  assert.equal(g.at(-1)!.date, '2026-10-04');
  assert.equal(monthGrid(2026, 1).filter(c => c.inMonth).length, 28);
  assert.equal(monthGrid(2026, 11).filter(c => c.inMonth).length, 31);   // December rolls the year for its length
  assert.equal(heat(50, 200), 0.25);
  assert.equal(heat(5, 0), 0);
});
