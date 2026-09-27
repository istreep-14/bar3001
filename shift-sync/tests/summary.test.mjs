import test from 'node:test';
import assert from 'node:assert/strict';
import { summaryRows } from '../src/lib/summary.ts';

const v = (date, tips, type = 'night', party = false) => ({ shift: { id: date + tips, date, tips, start: 1080, end: 1440, shift_type: type, party }, income: [], crew: [], hours: 6, tph: tips / 6, extra: 0, wage: null, wageRate: null, total: tips, perHour: null, crewCount: 0, crewHours: 0 });
const data = [v('2026-09-02', 120), v('2026-09-10', 180, 'day'), v('2026-08-31', 60, 'night', true), v('2026-08-12', 300)];

test('month groups: newest first, sums, and the month before', () => {
  const r = summaryRows(data, 'month');
  assert.deepEqual(r.map(x => x.key), ['2026-09', '2026-08']);
  assert.equal(r[0].s.tips, 300);
  assert.equal(r[1].s.tips, 360);
  assert.equal(r[0].prev.tips, 360);
  assert.equal(r[1].prev, null);
});

test('week groups are Monday weeks and compare with the calendar week before', () => {
  const r = summaryRows(data, 'week');
  assert.deepEqual(r.map(x => x.key), ['2026-09-07', '2026-08-31', '2026-08-10']);
  assert.equal(r[1].s.tips, 180);                    // Mon 08-31 (60) and Wed 09-02 (120)
  assert.equal(r[0].prev.tips, 180);                 // the week of 09-07 follows it
  assert.equal(r[1].prev, null);                     // nothing was logged in the week of 08-24
});

test('weekday, type and party groups', () => {
  assert.deepEqual(summaryRows(data, 'weekday').map(x => x.key), ['0', '2', '3']);   // Mon, Wed, Thu
  assert.deepEqual(summaryRows(data, 'type').map(x => x.key).sort(), ['day', 'night']);
  const p = summaryRows(data, 'party');
  assert.equal(p.find(x => x.key === 'party').s.tips, 60);
  assert.equal(p[0].prev, null);
});
