import test from 'node:test';
import assert from 'node:assert/strict';
import { crewWeek } from '../src/lib/hub.ts';

const view = (date, crew) => ({ shift: { id: 's' + date, date, start: 1080, end: 1440 }, crew: crew.map(([staff_id, start, end]) => ({ id: staff_id + date, shift_id: 's' + date, staff_id, name: staff_id, start, end })) });
const people = [{ id: 'me', name: 'Ian', is_user: true }, { id: 'a', name: 'Abby' }, { id: 'b', name: 'Billy' }];

test('rows are the bartenders on that week, you first; cells hold their hours; totals add up', () => {
  const v = [view('2026-09-21', [['me', 1080, 1440], ['a', 1020, 1500]]), view('2026-09-23', [['a', 1080, 1440]]), view('2026-09-30', [['b', 1080, 1440]])];   // the last is next week
  const g = crewWeek(v, '2026-09-21', people);
  assert.deepEqual(g.rows.map(r => r.name), ['Ian', 'Abby']);
  assert.deepEqual(g.days[0], '2026-09-21');
  assert.equal(g.rows[1].cells[0].hours, 8);            // 5p to 1a
  assert.equal(g.rows[1].cells[2].hours, 6);
  assert.equal(g.rows[1].hours, 14);
  assert.equal(g.rows[0].cells[2].shifts[0].line, null);  // there was a shift on the 23rd, Ian wasn't on it
  assert.equal(g.rows[0].cells[1].shifts.length, 0);      // no shift on the 22nd
  assert.deepEqual(g.dayHours, [14, 0, 6, 0, 0, 0, 0]);
  assert.equal(g.total, 20);
});

test('an added row shows even with no hours yet', () => {
  const g = crewWeek([view('2026-09-21', [['me', 1080, 1440]])], '2026-09-21', people, ['b']);
  assert.deepEqual(g.rows.map(r => r.name), ['Ian', 'Billy']);
  assert.equal(g.rows[1].hours, 0);
});
