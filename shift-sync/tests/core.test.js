// Run: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const c = createRequire(import.meta.url)('../core/core.js');

const row = (o = {}) => ({ id: 'a', date: '2026-09-25', start: 1080, end: 120, tips: 240,
  notes: null, updated_at: 1000, deleted: false, other: 50, shift_type: 'night', party: false, ...o });

test('time conversion round-trips and tolerates 1-digit hours', () => {
  assert.equal(c.toMin('18:00'), 1080);
  assert.equal(c.toMin('6:05'), 365);
  assert.equal(c.toHHMM(365), '06:05');
  assert.equal(c.toMin(''), null);
  assert.equal(c.toHHMM(null), '');
});

test('bad times throw', () => {
  for (const t of ['24:00', '12:60', '6pm', '1800']) assert.throws(() => c.toMin(t));
});

test('hours handle past-midnight shifts and nulls', () => {
  assert.equal(c.hoursWorked(1080, 120), 8);   // 6pm -> 2am
  assert.equal(c.hoursWorked(600, 960), 6);
  assert.equal(c.hoursWorked(null, 120), null);
});

test('sheet round-trip preserves row, blanks become null', () => {
  const r = row({ tips: null, notes: null });
  assert.deepEqual(c.sheetToRow(c.rowToSheet(r)), r);
  const s = c.sheetToRow(['a', '2026-09-25', '', '', '', '', 5, 'FALSE']);
  assert.equal(s.start, null); assert.equal(s.tips, null); assert.equal(s.notes, null);
});

test('sheet parsing reads TRUE/true/boolean as deleted', () => {
  for (const v of [true, 'TRUE', 'true']) assert.equal(c.sheetToRow(c.rowToSheet(row()).map((x, i) => i === 7 ? v : x)).deleted, true);
});

test('validation rejects bad rows', () => {
  assert.throws(() => c.validateRow(row({ id: '' })));
  assert.throws(() => c.validateRow(row({ date: '9/25/2026' })));
  assert.throws(() => c.validateRow(row({ start: 1440 })));
  assert.throws(() => c.validateRow(row({ tips: '240' })));
  assert.throws(() => c.validateRow(row({ updated_at: undefined })));
});

test('pickNewer: newer wins, tie keeps current', () => {
  const a = row({ updated_at: 1 }), b = row({ updated_at: 2 });
  assert.equal(c.pickNewer(a, b), b);
  assert.equal(c.pickNewer(b, a), b);
  const t = row({ updated_at: 1, tips: 5 });
  assert.equal(c.pickNewer(a, t), a);
  assert.equal(c.pickNewer(undefined, a), a);
});

test('mergeInto adds new, applies newer, ignores older', () => {
  const map = { a: row({ updated_at: 10 }), b: row({ id: 'b', updated_at: 10 }) };
  const changed = c.mergeInto(map, [
    row({ updated_at: 5, tips: 1 }),            // older: ignored
    row({ id: 'b', updated_at: 20, tips: 2 }),  // newer: applied
    row({ id: 'n', updated_at: 1 })             // new: added
  ]);
  assert.deepEqual(changed.sort(), ['b', 'n']);
  assert.equal(map.a.tips, 240);
  assert.equal(map.b.tips, 2);
});

test('reconcileClient: server wins unless local dirty and newer', () => {
  const local = {
    a: { ...row({ updated_at: 5 }), _dirty: true },           // pushed; server echoes it
    b: { ...row({ id: 'b', updated_at: 99 }), _dirty: true }, // edited mid-flight
    c: { ...row({ id: 'c' }), _dirty: false },                // deleted in Sheet
    d: { ...row({ id: 'd' }), _dirty: true }                  // created mid-flight
  };
  const server = [row({ updated_at: 5 }), row({ id: 'b', updated_at: 50 }), row({ id: 'e' })];
  const out = c.reconcileClient(local, server);
  assert.equal(out.a._dirty, false);
  assert.equal(out.b.updated_at, 99); assert.equal(out.b._dirty, true);
  assert.equal(out.c, undefined);
  assert.equal(out.d._dirty, true);
  assert.equal(out.e._dirty, false);
});

test('reconcileClient keeps held rows (Sheet typo) instead of dropping them', () => {
  const local = { h: { ...row({ id: 'h' }), _dirty: false } };
  assert.equal(c.reconcileClient(local, [], ['h']).h.id, 'h');
  assert.equal(c.reconcileClient(local, []).h, undefined);
});

test('stripLocal removes client-only fields', () => {
  assert.equal('_dirty' in c.stripLocal({ ...row(), _dirty: true }), false);
});

test('derived: tips/hr and total income; null when hours or tips missing', () => {
  assert.equal(c.tipsPerHour(row({ tips: 240 })), 30);          // 18:00-02:00 = 8h
  assert.equal(c.tipsPerHour(row({ start: null })), null);
  assert.equal(c.tipsPerHour(row({ tips: null })), null);
  assert.equal(c.totalIncome(row({ tips: 240, other: 50 })), 290);
  assert.equal(c.totalIncome(row({ tips: null, other: null })), 0);
});

test('rows from before the other column validate with other = null', () => {
  const old = row(); delete old.other;
  assert.equal(c.validateRow(old).other, null);
  assert.equal(c.sheetToRow(['a', '2026-09-25', '18:00', '02:00', 240, '', 1000, false]).other, null);
  assert.throws(() => c.validateRow(row({ other: '5' })));
});

test('defaultShiftType: 3pm or later is night, earlier is day, no start is null', () => {
  assert.equal(c.defaultShiftType(900), 'night');
  assert.equal(c.defaultShiftType(899), 'day');
  assert.equal(c.defaultShiftType(null), null);
});

test('shift_type validates, round-trips, and old rows default to null', () => {
  assert.throws(() => c.validateRow(row({ shift_type: 'swing' })));
  assert.equal(c.sheetToRow(c.rowToSheet(row({ shift_type: 'day' }))).shift_type, 'day');
  assert.equal(c.sheetToRow(['a', '2026-09-25', '', '', '', '', 5, false, '', 'Night']).shift_type, 'night');
  const old = row(); delete old.shift_type;
  assert.equal(c.validateRow(old).shift_type, null);
});

test('income: validate, sheet round-trip, category matching, sums', () => {
  const i = { id: 'i1', shift_id: 'a', category: 'Cash', amount: 40, note: null, updated_at: 1, deleted: false };
  assert.deepEqual(c.sheetToIncome(c.incomeToSheet(i)), i);
  assert.equal(c.sheetToIncome(['i1', 'a', ' venmo ', 5, '', 1, false]).category, 'Venmo');
  assert.throws(() => c.validateIncome({ ...i, category: 'Gift' }));
  assert.throws(() => c.validateIncome({ ...i, amount: null }));
  assert.throws(() => c.validateIncome({ ...i, shift_id: '' }));
  assert.equal(c.sumIncome([i, { ...i, amount: 10 }]), 50);
  assert.equal(c.totalIncome(row({ tips: 100, other: 5 }), [i]), 145);
});

test('staff: validate, sheet round-trip, roles split, blank status is active', () => {
  const p = { id: 'p1', name: ' Abby ', first: 'Abby', last: null, roles: [' Bartender ', '', 'Server'], id_number: 'E1292',
    manager: 1, is_user: false, status: 'active', notes: '', updated_at: 5, deleted: false };
  const v = c.validateStaff(p);
  assert.deepEqual(v.roles, ['Bartender', 'Server']);
  assert.equal(v.name, 'Abby');
  assert.equal(v.manager, true);
  assert.equal(v.notes, null);
  assert.deepEqual(c.sheetToStaff(c.staffToSheet(v)), v);
  assert.equal(c.sheetToStaff(['p1', 'Abby', '', '', '', '', '', '', '', '', 5, false]).status, 'active');
  assert.throws(() => c.validateStaff({ ...p, name: '  ' }), /Missing name/);
  assert.throws(() => c.validateStaff({ ...p, status: 'fired' }), /Bad status/);
  assert.throws(() => c.validateStaff({ ...p, roles: 'Bartender' }), /Bad roles/);
  assert.deepEqual(v.aliases, []);
  assert.equal(v.photo, null);
});

test('staff aliases: trimmed, one per spelling, never the name, no commas; avatar fields checked', () => {
  const p = { id: 'p1', name: 'Abby', roles: [], status: 'active', updated_at: 5, deleted: false };
  const v = c.validateStaff({ ...p, aliases: [' Abs ', 'abs', 'ABBY', '', 'A, C', 'Abigail'], avatar_color: '#1a2B3c', avatar_text: ' ab ' });
  assert.deepEqual(v.aliases, ['Abs', 'A C', 'Abigail']);
  assert.equal(v.avatar_text, 'ab');
  assert.deepEqual(c.sheetToStaff(c.staffToSheet(v)), v);
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(100);
  assert.equal(c.validateStaff({ ...p, photo, avatar_color: 'venmo' }).photo, photo);
  assert.throws(() => c.validateStaff({ ...p, photo: 'https://x/y.png' }), /Bad photo/);
  assert.throws(() => c.validateStaff({ ...p, photo: 'data:image/png;base64,' + 'A'.repeat(50000) }), /too large/);
  assert.throws(() => c.validateStaff({ ...p, avatar_color: 'rgb(0,0,0)' }), /Bad avatar_color/);
  assert.throws(() => c.validateStaff({ ...p, avatar_text: 'ABCD' }), /3 characters/);
  assert.throws(() => c.validateStaff({ ...p, aliases: 'Abs' }), /Bad aliases/);
});

test('staff main role: kept apart from the other roles, and a row from before it has none', () => {
  const p = { id: 'p1', name: 'Abby', roles: ['Server', 'bartender', 'Host', 'server'], status: 'active', updated_at: 5, deleted: false };
  const v = c.validateStaff({ ...p, role: ' Bartender ' });
  assert.equal(v.role, 'Bartender');
  assert.deepEqual(v.roles, ['Server', 'Host']);
  assert.deepEqual(c.sheetToStaff(c.staffToSheet(v)), v);
  assert.equal(c.validateStaff(p).role, null);
});

test('roles: validate, sheet round-trip, rank defaults to 0', () => {
  const r = { id: 'r1', name: '  Head   Bartender ', color: 'teal', icon: 'crown', sort: 2, updated_at: 5, deleted: false };
  const v = c.validateRole(r);
  assert.equal(v.name, 'Head Bartender');
  assert.deepEqual(c.sheetToRole(c.roleToSheet(v)), v);
  assert.equal(c.validateRole({ ...r, sort: '' }).sort, 0);
  assert.equal(c.validateRole({ ...r, color: '', icon: '' }).color, null);
  assert.throws(() => c.validateRole({ ...r, name: 'A, B' }), /comma/);
  assert.throws(() => c.validateRole({ ...r, icon: '<svg>' }), /Bad icon/);
  assert.throws(() => c.validateRole({ ...r, color: 'rgb(1,2,3)' }), /Bad color/);
});

test('crew: validate, sheet round-trip (times as HH:MM), hours summed across midnight, blanks count as a person only', () => {
  const m = { id: 'c1', shift_id: 's', staff_id: 'p1', name: ' Abby ', start: 1080, end: 120, updated_at: 5, deleted: false };
  const v = c.validateCrew(m);
  assert.equal(v.name, 'Abby');
  assert.deepEqual(c.crewToSheet(v), ['c1', 's', 'p1', 'Abby', '18:00', '02:00', 5, false, 8]);   // last column: derived hours
  assert.deepEqual(c.sheetToCrew(c.crewToSheet(v)), v);
  assert.equal(c.validateCrew({ ...m, start: undefined, end: null, name: '' }).start, null);
  assert.equal(c.crewHours([v, { start: 600, end: 960 }, { start: null, end: null }]), 8 + 6);
  assert.equal(c.crewHours([]), 0);
  assert.throws(() => c.validateCrew({ ...m, staff_id: '' }), /Missing staff_id/);
  assert.throws(() => c.validateCrew({ ...m, start: 1440 }), /Bad start/);
});

test('wage: the rate in effect is the latest one starting on or before the date', () => {
  const rates = [{ date: '2026-05-17', rate: 7 }, { date: '2024-10-23', rate: 5 }, { date: '2025-12-28', rate: 6 }];   // any order
  assert.equal(c.wageRateFor(rates, '2024-10-22'), null);        // before the first
  assert.equal(c.wageRateFor(rates, '2024-10-23'), 5);           // on the day it starts
  assert.equal(c.wageRateFor(rates, '2025-12-27'), 5);
  assert.equal(c.wageRateFor(rates, '2025-12-28'), 6);
  assert.equal(c.wageRateFor(rates, '2026-09-25'), 7);           // still in effect until the next one
  assert.equal(c.wageRateFor([], '2026-01-01'), null);
  assert.equal(c.wageFor(rates, '2026-06-01', 9.5), 66.5);
  assert.equal(c.wageFor(rates, '2026-06-01', null), null);      // no hours, no estimate
  assert.equal(c.wageFor(rates, '2020-01-01', 8), null);         // no rate yet
  assert.equal(c.totalIncome(row({ tips: 100, other: 5 }), [], 63), 168);
});

test('wage rows: validate and round-trip through the Sheet', () => {
  const w = { id: 'w1', date: '2025-12-28', rate: 6, note: ' raise ', updated_at: 3, deleted: false };
  const v = c.validateWage(w);
  assert.equal(v.note, ' raise ');   // notes are kept as typed, like Income's
  assert.deepEqual(c.sheetToWage(c.wageToSheet(v)), v);
  assert.throws(() => c.validateWage({ ...w, rate: -1 }), /Bad rate/);
  assert.throws(() => c.validateWage({ ...w, date: '12/28/2025' }), /Bad date/);
});

test('party: a boolean per shift, false when missing, round-trips through the Sheet as TRUE/FALSE', () => {
  const old = row(); delete old.party;
  assert.equal(c.validateRow(old).party, false);
  assert.equal(c.validateRow(row({ party: true })).party, true);
  assert.equal(c.rowToSheet(row({ party: true }))[10], true);
  assert.equal(c.sheetToRow(c.rowToSheet(row({ party: true }))).party, true);
  assert.equal(c.sheetToRow(['a', '2026-09-25', '', '', '', '', 5, false, '', '']).party, false);   // a Sheet from before the column
  assert.equal(c.sheetToRow(['a', '2026-09-25', '', '', '', '', 5, false, '', '', 'TRUE']).party, true);
});
