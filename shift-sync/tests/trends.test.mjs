import test from 'node:test';
import assert from 'node:assert/strict';
import { focusWindow, pctChange, hoursPerWeek, weeklySeries, histogram, slotInsight } from '../src/lib/trends.ts';

const v = (date, tips, start, end, type = 'night') => ({ shift: { id: date + start, date, tips, start, end, shift_type: type }, income: [], crew: [], hours: (end - start) / 60, tph: tips / ((end - start) / 60), extra: 0, wage: null, wageRate: null, total: tips, perHour: null, crewCount: 0, crewHours: 0 });

test('focus windows compare equal spans', () => {
  const w = focusWindow('week', '2026-09-24');   // a Thursday
  assert.deepEqual([w.from, w.to, w.prevFrom, w.prevTo, w.days], ['2026-09-21', '2026-09-24', '2026-09-14', '2026-09-17', 4]);
  const f = focusWindow('fortnight', '2026-09-24');
  assert.deepEqual([f.from, f.prevFrom, f.prevTo, f.days], ['2026-09-11', '2026-08-28', '2026-09-10', 14]);
  const m = focusWindow('month', '2026-03-31');
  assert.deepEqual([m.from, m.prevFrom, m.prevTo], ['2026-03-01', '2026-02-01', '2026-02-28']);
});

test('pctChange and hoursPerWeek', () => {
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(90, 100), -10);
  assert.equal(pctChange(5, 0), null);
  assert.equal(pctChange(null, 5), null);
  assert.equal(hoursPerWeek(23, 4), 23);          // a part-week is left alone
  assert.equal(hoursPerWeek(60, 30), 14);         // a month is averaged to 7 days
});

test('weeklySeries: Monday weeks, empty weeks kept, smoothing over 4 weeks', () => {
  const all = [v('2026-09-07', 200, 1080, 1440), v('2026-09-22', 300, 1080, 1440)];   // 6h each
  const s = weeklySeries(all, '2026-09-24', 3);
  assert.deepEqual(s.map(p => p.key), ['2026-09-07', '2026-09-14', '2026-09-21']);
  assert.deepEqual(s.map(p => p.n), [1, 0, 1]);
  assert.equal(s[1].tph, null);
  assert.ok(Math.abs(s[0].tph - 200 / 6) < 1e-9);
  assert.ok(Math.abs(s[2].smooth - 500 / 12) < 1e-9);   // both shifts sit inside the 4 weeks ending 09-27
  assert.equal(s[2].partial, true);
  assert.equal(s[0].partial, false);
  assert.equal(weeklySeries(all, '2026-09-24', null).length, 3);
});

test('histogram bins, mean and median', () => {
  assert.equal(histogram([10, 20]), null);
  const h = histogram([12, 18, 22, 27, 31, 85]);
  assert.equal(h.bins.reduce((a, b) => a + b.n, 0), 6);
  assert.equal(h.median, 24.5);
  assert.ok(h.mean > h.median);                   // a long right tail: skewed high
  assert.ok(h.bins[0].lo <= 12 && h.bins.at(-1).hi > 85);
});

test('slotInsight compares the newest shift with the last 4 of its weekday and type', () => {
  // Wednesdays, night: 09-23 is the newest; four before it at $30/hr, one Thursday and one day shift that must be ignored.
  const wed = ['2026-08-26', '2026-09-02', '2026-09-09', '2026-09-16'].map(d => v(d, 180, 1080, 1440));   // 6h, $30/hr
  const latest = v('2026-09-23', 162, 1080, 1440);                                                        // $27/hr
  const noise = [v('2026-09-17', 600, 1080, 1440), v('2026-09-16', 600, 600, 960, 'day')];
  const i = slotInsight([...wed, latest, ...noise.slice(1)]);
  assert.equal(i.label, 'Wednesday night');
  assert.equal(i.n, 4);
  assert.ok(Math.abs(i.base - 30) < 1e-9);
  assert.ok(Math.abs(i.pct - -10) < 1e-9);
  assert.equal(slotInsight([latest]), null);
});

import { rateScale } from '../src/lib/calendar.ts';
test('rateScale: above the median is hi, below is lo, deeper the further out', () => {
  const sc = rateScale([20, 30, 40, 50, 60]);
  assert.equal(sc.median, 40);
  assert.equal(sc.at(40).side, 'hi');
  assert.equal(sc.at(20).side, 'lo');
  assert.ok(sc.at(60).mag > sc.at(45).mag);
  assert.ok(sc.at(20).mag > sc.at(35).mag);
  assert.equal(sc.at(null), null);
  assert.equal(rateScale([30]), null);
});
