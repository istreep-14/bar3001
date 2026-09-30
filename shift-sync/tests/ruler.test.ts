import test from 'node:test';
import assert from 'node:assert/strict';
import { nowOnRuler, place, rulerFor, tickLabel } from '../src/lib/ruler.ts';

test('evening shifts get a noon ruler long enough for the latest end', () => {
  const r = rulerFor([{ start: 18 * 60, end: 150 }, { start: 16 * 60, end: 150 }]);
  assert.equal(r.origin, 720);
  assert.equal(r.origin + r.length >= 1440 + 150, true);
  assert.equal(tickLabel(r.ticks[0]!), '12 PM');
});

test('a day shift that starts before noon moves the origin back', () => {
  const r = rulerFor([{ start: 11 * 60, end: 17 * 60 }, { start: 18 * 60, end: 120 }]);
  assert.equal(r.origin, 660);
});

test('bars line up by time of day and wrap past midnight', () => {
  const r = rulerFor([{ start: 17 * 60, end: 150 }]);
  const a = place(18 * 60, 150, r)!, b = place(17 * 60, 150, r)!;
  assert.ok(a.left > b.left);
  assert.ok(Math.abs(a.left + a.width - (b.left + b.width)) < 1e-9);   // same end
  assert.equal(place(null, 150, r), null);
  assert.ok(a.left + a.width <= 100);
});

test('now sits on an evening ruler after midnight, and is gone in the morning', () => {
  const r = rulerFor([{ start: 17 * 60, end: 150 }]);
  const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);
  const night = nowOnRuler(r, at(20))!;
  const late = nowOnRuler(r, at(1))!;
  assert.ok(night > 0 && night < 100);
  assert.ok(late > night);
  assert.equal(nowOnRuler(r, at(10)), null);
});
