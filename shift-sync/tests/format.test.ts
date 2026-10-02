import test from 'node:test';
import assert from 'node:assert/strict';
import { DASH, clock, clockPlain, clockShort, clockTight, dateCell, dec1, hours, hoursBare, int, isPastYear, longDate, money, perHour, perHourWhole, weekLabel } from '../src/lib/format.ts';

test('clock is exact and fixed-width so times align', () => {
  assert.equal(clock(17 * 60), '05:00 PM');
  assert.equal(clock(0), '12:00 AM');
  assert.equal(clock(12 * 60), '12:00 PM');
  assert.equal(clock(23 * 60 + 5), '11:05 PM');
  assert.equal(clock(2 * 60 + 10), '02:10 AM');
  assert.equal(clock(null), '');
  for (const m of [0, 65, 600, 720, 1020, 1439]) assert.equal(clock(m).length, 8);
});

test('table figures round to whole numbers; absent is a dash', () => {
  assert.equal(int(8.17), '8');
  assert.equal(int(9.5), '10');
  assert.equal(int(240), '240');
  assert.equal(int(0), '0');
  assert.equal(int(null), DASH);
});

test('a rate reads one way: two decimals like money, per hour; whole only where that cannot fit', () => {
  assert.equal(perHour(12.4), money(12.4) + '/hr');
  assert.match(perHour(12.4), /12\.40\/hr$/);
  assert.match(perHourWhole(12.4), /12\/hr$/);
  assert.equal(perHour(null), DASH);
  assert.equal(perHourWhole(undefined), DASH);
});

test('date cells are fixed width', () => {
  assert.equal(dateCell('2026-09-05'), 'Sep 5');
  assert.equal(dateCell('2026-09-25'), 'Sep 25');
  assert.equal(weekLabel('2026-09-25'), 'September 21 – 27, 2026');
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


test('reading times are 12-hour with AM/PM and no leading zero', () => {
  assert.equal(clockPlain(18 * 60), '6:00 PM');
  assert.equal(clockPlain(2 * 60 + 30), '2:30 AM');
  assert.equal(clockPlain(0), '12:00 AM');
  assert.equal(clockPlain(12 * 60 + 15), '12:15 PM');
  assert.equal(clockPlain(null), '');
});

test('clockTight: minutes only when there are any, a/p, never 24-hour', () => {
  assert.equal(clockTight(18 * 60), '6p');
  assert.equal(clockTight(17 * 60 + 30), '5:30p');
  assert.equal(clockTight(0), '12a');
  assert.equal(clockTight(12 * 60 + 5), '12:05p');
  assert.equal(clockTight(null), '');
});

test('hours: one decimal at most, with or without the unit', () => {
  assert.equal(hours(8), '8h');
  assert.equal(hoursBare(8), '8');
  assert.equal(hoursBare(6.5), '6.5');
  assert.equal(hoursBare(7.25), '7.3');
  assert.equal(hoursBare(null), DASH);
});

test('clockParts: the hour padded to two characters, so colons line up', async () => {
  const { clockParts } = await import('../src/lib/format.ts');
  assert.deepEqual(clockParts(18 * 60), { hm: '\u20076:00', ap: 'PM' });
  assert.deepEqual(clockParts(11 * 60 + 30), { hm: '11:30', ap: 'AM' });
  assert.deepEqual(clockParts(0), { hm: '12:00', ap: 'AM' });
  assert.deepEqual(clockParts(2 * 60 + 5), { hm: '\u20072:05', ap: 'AM' });
});

test('weekShort names a Monday-to-Sunday week briefly, the second month only when the week runs into it', async () => {
  const { weekShort } = await import('../src/lib/format.ts');
  assert.equal(weekShort('2026-09-25'), 'Sep 21 – 27');
  assert.equal(weekShort('2026-09-21'), 'Sep 21 – 27');
  assert.equal(weekShort('2026-09-27'), 'Sep 21 – 27');   // Sunday closes the week it belongs to
  assert.equal(weekShort('2026-10-02'), 'Sep 28 – Oct 4');
  assert.equal(weekShort('2025-12-31'), 'Dec 29 – Jan 4');
});

test('monthShort is the month alone in this year, with the year otherwise', async () => {
  const { monthShort } = await import('../src/lib/format.ts');
  const y = new Date().getFullYear();
  assert.equal(monthShort(`${y}-09`), 'September');
  assert.equal(monthShort(`${y}-09-30`), 'September');
  assert.equal(monthShort('2020-03'), 'March 2020');
});
