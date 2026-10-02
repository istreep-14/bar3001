import test from 'node:test';
import assert from 'node:assert/strict';
import type { Income, Shift } from '../src/core/core.generated.js';
import { bandLabel, groupCount, groupShifts, incomeParts, isPending, monthInRow, rowDay } from '../src/lib/groups.ts';
import { toView } from '../src/lib/stats.ts';

const shift = (o: Partial<Shift> = {}): Shift => ({ id: 'a', date: '2026-09-25', start: 1080, end: 150, tips: 329, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false, ...o });
const inc = (o: Partial<Income> = {}): Income => ({ id: 'i', shift_id: 'a', category: 'Chump', amount: 40, note: null, updated_at: 1, deleted: false, ...o });
const RATES = [{ date: '2026-01-01', rate: 7 }];

test('a shift with no tips and no other income is pending, anything with money is not', () => {
  assert.equal(isPending(toView(shift({ tips: null, end: null }), [])), true);
  assert.equal(isPending(toView(shift({ tips: null }), [inc()])), false);
  assert.equal(isPending(toView(shift({ tips: null, other: 5 }), [])), false);
  assert.equal(isPending(toView(shift({ tips: null, other: 0 }), [])), true);   // 0 is no money, same as blank
  assert.equal(isPending(toView(shift({ tips: 0 }), [])), false);
});

test('month groups keep arrival order, count scheduled and worked apart, and total only the done shifts', () => {
  const views = [
    toView(shift({ id: 'o1', date: '2026-10-01', tips: null, end: null }), [], [], RATES),
    toView(shift({ id: 's30', date: '2026-09-30', tips: null, end: null }), [], [], RATES),
    toView(shift({ id: 'w29', date: '2026-09-29', tips: null }), [], [], RATES),
    toView(shift({ id: 's25', date: '2026-09-25' }), [], [], RATES),
    toView(shift({ id: 's24', date: '2026-09-24' }), [inc({ shift_id: 's24' })], [], RATES),
    toView(shift({ id: 'a28', date: '2026-08-28', tips: 343 }), [], [], RATES)
  ];
  const g = groupShifts(views, 'month');
  assert.deepEqual(g.map(x => x.key), ['2026-10', '2026-09', '2026-08']);
  assert.deepEqual(g.map(x => [x.done, x.worked, x.scheduled]), [[0, 0, 1], [2, 1, 1], [1, 0, 0]]);
  assert.equal(g[1]!.total, views[3]!.total + views[4]!.total);
  assert.equal(g[0]!.total, 0);
  assert.match(g[1]!.label, /September/);
});

test('week groups start on Monday; flat is one unlabelled group', () => {
  const views = ['2026-09-28', '2026-09-27', '2026-09-21', '2026-09-20'].map((date, i) => toView(shift({ id: String(i), date }), []));
  assert.deepEqual(groupShifts(views, 'week').map(x => [x.key, x.views.length]), [['2026-09-28', 1], ['2026-09-21', 2], ['2026-09-14', 1]]);
  const flat = groupShifts(views, 'none');
  assert.equal(flat.length, 1);
  assert.equal(flat[0]!.label, '');
});

test('the row says just the day; the band already says the month', () => {
  assert.equal(rowDay('2026-09-24'), 'Thu 24');
});

test('income parts come in a fixed order, skip zeros, and add up to the total', () => {
  const v = toView(shift({ other: 10 }), [inc({ category: 'Venmo', amount: 5 }), inc({ id: 'j', amount: 40 }), inc({ id: 'k', amount: 2 })], [], RATES);
  const parts = incomeParts(v);
  assert.deepEqual(parts.map(p => p.key), ['tips', 'wage', 'Chump', 'Venmo', 'other']);
  assert.equal(parts.find(p => p.key === 'Chump')!.amount, 42);
  assert.equal(parts.find(p => p.key === 'wage')!.estimated, true);
  assert.ok(Math.abs(parts.reduce((t, p) => t + p.amount, 0) - v.total) < 1e-9);
  assert.deepEqual(incomeParts(toView(shift({ tips: null, start: null, end: null }), [])), []);
});

test('a row names its month only where no band above already does', () => {
  assert.equal(monthInRow('2026-09-25', 'none'), true);
  assert.equal(monthInRow('2026-09-25', 'month'), false);
  assert.equal(monthInRow('2026-09-25', 'week'), false);    // Sep 21 – 27 stays in September
  assert.equal(monthInRow('2026-10-02', 'week'), true);     // Sep 28 – Oct 4 runs into October
});

test('bands carry a short name for the day column and the long one for their title', () => {
  assert.deepEqual(bandLabel('2026-09-21', 'week'), { name: 'Sep 21 – 27', title: 'September 21 – 27, 2026' });
  assert.deepEqual(bandLabel('2026-09-28', 'week'), { name: 'Sep 28 – Oct 4', title: 'September 28 – October 4, 2026' });
  assert.equal(bandLabel('2020-03', 'month').name, 'March 2020');
  assert.equal(bandLabel('2020-03', 'month').title, 'March 2020');
});

test('a band counts its shifts and says what is not counted yet only when there is some', () => {
  const v = toView(shift(), []);
  assert.equal(groupCount({ views: [v], worked: 0, scheduled: 0 }), '1 shift');
  assert.equal(groupCount({ views: [v, v, v], worked: 1, scheduled: 1 }), '3 shifts · 1 awaiting tips · 1 upcoming');
  assert.equal(groupCount({ views: [v, v], worked: 0, scheduled: 2 }), '2 shifts · 2 upcoming');
});
