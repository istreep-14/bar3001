import test from 'node:test';
import assert from 'node:assert/strict';
import type { Shift } from '../src/core/core.generated.js';
import { bestShifts, waiting, weekCompare } from '../src/lib/dashboard.ts';
import { toView } from '../src/lib/stats.ts';

const shift = (o: Partial<Shift> = {}): Shift => ({ id: 'a', date: '2026-09-25', start: 1080, end: 150, tips: 300, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false, ...o });
const v = (o: Partial<Shift>) => toView(shift(o), []);

test('a finished week against the week before, Monday to Sunday like the rest of the app', () => {
  const views = [
    v({ id: 'a', date: '2026-09-26', tips: 300 }),          // Sat, this week (Sep 21 – 27)
    v({ id: 'b', date: '2026-09-21', tips: 200 }),          // Mon, this week
    v({ id: 'c', date: '2026-09-18', tips: 250 }),          // Fri, last week
    v({ id: 'd', date: '2026-09-28', tips: null, end: null }) // next week, waiting on tips
  ];
  const w = weekCompare(views, '2026-09-27');              // Sunday: the week is complete
  assert.equal(w.start, '2026-09-21');
  assert.equal(w.partial, false);
  assert.equal(w.now.shifts, 2);
  assert.equal(w.now.tips, 500);
  assert.equal(w.before.tips, 250);
  assert.equal(w.delta.tips, 100);
  assert.equal(w.days.length, 7);
  assert.equal(w.days[6]!.date, '2026-09-27');
  assert.equal(w.days[0]!.tips, 200);
});

test('a running week compares with the same days of last week; a past week with the whole week before', () => {
  const views = [
    v({ id: 'mon', date: '2026-09-21', tips: 200 }), v({ id: 'sat', date: '2026-09-26', tips: 300 }),   // last week
    v({ id: 'now', date: '2026-09-29', tips: 100 })                                                     // Tuesday this week
  ];
  const w = weekCompare(views, '2026-09-29');
  assert.equal(w.partial, true);
  assert.equal(w.before.tips, 200);      // Mon 21 – Tue 22 only, not Saturday
  assert.equal(w.delta.tips, -50);
  const last = weekCompare(views, '2026-09-28', -1);
  assert.equal(last.partial, false);
  assert.equal(last.start, '2026-09-21');
  assert.equal(last.now.tips, 500);
});

test('with nothing last week the deltas are empty, not infinite', () => {
  const w = weekCompare([v({ date: '2026-09-22' })], '2026-09-26');
  assert.equal(w.delta.tips, null);
  assert.equal(w.delta.tph, null);
});

test('best shifts rank by tips per hour within the window', () => {
  const views = [
    v({ id: 'old', date: '2026-01-02', tips: 900 }),
    v({ id: 'mid', date: '2026-09-10', tips: 300 }),
    v({ id: 'top', date: '2026-09-11', tips: 400 }),
    v({ id: 'none', date: '2026-09-12', tips: null, end: null })
  ];
  assert.deepEqual(bestShifts(views, '2026-09-26').map(x => x.shift.id), ['top', 'mid']);
});

test('waiting lists pending shifts oldest first', () => {
  const views = [v({ id: 'x', date: '2026-10-01', tips: null }), v({ id: 'y', date: '2026-09-30', tips: null }), v({ id: 'z', date: '2026-09-29' })];
  assert.deepEqual(waiting(views).map(x => x.shift.id), ['y', 'x']);
});
