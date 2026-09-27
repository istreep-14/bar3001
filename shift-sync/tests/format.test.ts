import test from 'node:test';
import assert from 'node:assert/strict';
import { DASH, clock, clockShort, dateCell, dec1, int, isPastYear, longDate, timeRange, weekLabel } from '../src/lib/format.ts';

test('clock is exact and fixed-width so times align', () => {
  assert.equal(clock(17 * 60), '05:00 PM');
  assert.equal(clock(0), '12:00 AM');
  assert.equal(clock(12 * 60), '12:00 PM');
  assert.equal(clock(23 * 60 + 5), '11:05 PM');
  assert.equal(clock(2 * 60 + 10), '02:10 AM');
  assert.equal(clock(null), '');
  for (const m of [0, 65, 600, 720, 1020, 1439]) assert.equal(clock(m).length, 8);
  assert.equal(timeRange(1080, 120), '06:00 PM – 02:00 AM');
});

test('table figures round to whole numbers; absent is a dash', () => {
  assert.equal(int(8.17), '8');
  assert.equal(int(9.5), '10');
  assert.equal(int(240), '240');
  assert.equal(int(0), '0');
  assert.equal(int(null), DASH);
});

test('date cells are fixed width', () => {
  assert.equal(dateCell('2026-09-05'), 'Sep 5');
  assert.equal(dateCell('2026-09-25'), 'Sep 25');
  assert.equal(weekLabel('2026-09-25'), 'Sep 20 – 26, 2026');
});

test('hours show one decimal so 8.0 and 9.5 line up', () => {
  assert.equal(dec1(8), '8.0');
  assert.equal(dec1(9.5), '9.5');
  assert.equal(dec1(8.1666), '8.2');
  assert.equal(dec1(null), DASH);
});

test('table times are h:mm plus a/p, no leading zero', () => {
  assert.equal(clockShort(13 * 60 + 15), '1:15p');
  assert.equal(clockShort(18 * 60), '6:00p');
  assert.equal(clockShort(0), '12:00a');
  assert.equal(clockShort(12 * 60), '12:00p');
  assert.equal(clockShort(23 * 60 + 5), '11:05p');
  assert.equal(clockShort(null), '');
});

test('the year shows only for a past year, in the drawer title', () => {
  const y = new Date().getFullYear();
  assert.equal(isPastYear(`${y}-03-01`), false);
  assert.equal(isPastYear(`${y - 1}-03-01`), true);
  assert.doesNotMatch(longDate(`${y}-03-04`), new RegExp(String(y)));
  assert.match(longDate(`${y - 1}-03-04`), new RegExp(String(y - 1)));
});

