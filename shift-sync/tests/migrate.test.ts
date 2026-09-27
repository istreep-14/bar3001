import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, convert, wageOf } from '../scripts/brv2000.mjs';
import { planImport } from '../src/lib/bundle.ts';
import type { Bundle, Existing } from '../src/lib/bundle.ts';

const config = { workers: [
  { worker_id: 1444, name: 'Ian', first_name: 'Ian', last_name: 'Streeper', positions: ['Bar'], manager: true, is_user: true, ID: 'E1444' },
  { worker_id: 1292, name: 'Abby', first_name: 'Abby', last_name: null, positions: ['Bar', 'Server'], manager: false, is_user: false, ID: 'E1292' }
] };
const wage = { rateOverride: null, startOverride: null, endOverride: null };
const seg = (o = {}) => ({ type: 'night', start: 1020, end: 1560, breaks: [], wage, ...o });
const shifts = [
  { date: '2026-03-03', segments: [seg({ tips: 300, staff: [{ name: 'Ian', start: 1020, end: 1560, location: 'Main', breaks: [] }, { name: 'Abby', start: 960, end: 1410, location: 'Deck', breaks: [{ start: 1200, end: 1260 }] }, { name: 'Zed', start: 1020, end: 1100, location: 'Main', breaks: [] }] })] },
  { date: '2026-02-22', segments: [seg({ end: 1590, tips: 432, breaks: [{ start: 1080, end: 1140 }], otherIncome: [{ category: 'allotment', amount: 20 }, { category: 'chump', amount: 4, coinValue: 33 }, { category: 'employer', amount: 35 }] })] },
  { date: '2222-05-01', segments: [seg()] }
];

test('convert: times wrap past midnight, crew keeps its own times, the roster carries over', () => {
  const b = convert({ config, shifts, skipDates: ['2222-05-01'] });
  assert.deepEqual(b.skipped, ['2222-05-01']);
  assert.equal(b.rows.length, 2);
  const s = b.rows.find(r => r.date === '2026-03-03')!;
  assert.equal(s.end, 120);                     // 1560 min = 2:00 AM
  assert.equal(s.tips, 300);
  assert.equal(b.crew.filter(c => c.shift_id === s.id).length, 3);
  const abby = b.crew.find(c => c.name === 'Abby')!;
  assert.deepEqual([abby.start, abby.end], [960, 1410 % 1440]);
  assert.equal(b.staff.find(p => p.name === 'Ian')!.is_user, true);
  assert.deepEqual(b.staff.find(p => p.name === 'Abby')!.roles, ['Bar', 'Server']);
  assert.ok(b.staff.some(p => p.name === 'Zed'), 'someone missing from the roster is added, not dropped');
});

test('convert: income categories, and what has no field goes to the notes', () => {
  const b = convert({ config, shifts, skipDates: ['2222-05-01'] });
  assert.deepEqual(b.income.map(i => [i.category, i.amount, i.note]), [['Cash', 20, 'Pool allotment'], ['Chump', 4, 'coins $33'], ['Cash', 35, 'Employer cash']]);
  assert.equal(b.rows.find(r => r.date === '2026-02-22')!.notes, 'Break 6:00p–7:00p');
  const crewNote = b.rows.find(r => r.date === '2026-03-03')!.notes!;
  assert.match(crewNote, /Stations: Abby Deck/);
  assert.match(crewNote, /Crew breaks: Abby 8:00p–9:00p/);
});

test('convert: a shift with no staff list puts you alone on the crew with the shift times', () => {
  const b = convert({ config, shifts, skipDates: ['2222-05-01'] });
  const solo = b.crew.filter(c => c.shift_id === 'b2k-2026-02-22');
  assert.equal(solo.length, 1);
  assert.deepEqual([solo[0]!.name, solo[0]!.start, solo[0]!.end], ['Ian', 1020, 150]);
  assert.equal(clock(1560), '2:00a');
  assert.equal(clock(0), '12:00a');
  assert.equal(clock(780), '1:00p');
});

const none = (): Existing => ({ shiftIds: new Set(), incomeIds: new Set(), crewIds: new Set(), staffIds: new Set(), staff: [] });

test('import adds everything once and marks nothing it already has', () => {
  const b = convert({ config, shifts, skipDates: ['2222-05-01'] }) as unknown as Bundle;
  const plan = planImport(b, none(), 1000);
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.crew.length, 4);
  assert.equal(plan.income.length, 3);
  assert.equal(plan.staff.length, 3);
  assert.equal(plan.problems.length, 0);
  assert.ok(plan.rows.every(r => r.updated_at === 1000 && !r.deleted));
  // Second run over what the first one wrote: nothing new.
  const have: Existing = {
    shiftIds: new Set(plan.rows.map(r => r.id)), incomeIds: new Set(plan.income.map(r => r.id)),
    crewIds: new Set(plan.crew.map(r => r.id)), staffIds: new Set(plan.staff.map(r => r.id)), staff: plan.staff
  };
  const again = planImport(b, have, 2000);
  assert.deepEqual([again.rows.length, again.income.length, again.crew.length, again.staff.length], [0, 0, 0, 0]);
});

test('import matches people by name, keeps a single "me", and points crew at the local person', () => {
  const b = convert({ config, shifts, skipDates: ['2222-05-01'] }) as unknown as Bundle;
  const plan = planImport(b, { ...none(), staffIds: new Set(['mine']), staff: [{ id: 'mine', name: 'ian', is_user: true }] }, 1);
  assert.ok(!plan.staff.some(p => p.name === 'Ian'), 'Ian already on the roster (case-insensitive)');
  assert.ok(plan.crew.some(c => c.staff_id === 'mine'), 'his crew rows use the local id');
  assert.equal(plan.staff.filter(p => p.is_user).length, 0);
  const fresh = planImport(b, none(), 1);
  assert.equal(fresh.staff.filter(p => p.is_user).length, 1);
});

/* ── brv-flat ── */
import { convertFlat, parseCsv } from '../scripts/brvflat.mjs';

const staffCsv = `id,name,first,last,roles,id_number,manager,is_user,status,notes
st_ian,Ian,Ian,Streeper,Head Bartender,E1444,true,true,active,
st_mara,Mara,Mara,Quinn,Bartender|Barback,1088,,,inactive,"sample, row"
`;
const unlinkedCsv = `# no shift
id,date,category,amount,note
ui_01,2026-07-19,Venmo,85.00,deposit
`;
const shiftsCsv = `# comment line
date,start,end,shift_type,switchover,tips,day,night
2026-07-03,16:00,00:30,Night,,412.00,,"{""tips"":412.00,""location"":""Main bar"",""tags"":[""busy""],""notes"":""Eve"",""income"":[{""id"":""in_01"",""category"":""Cash"",""amount"":40.00,""note"":""door""}],""staff"":[{""id"":""a"",""staffId"":""st_mara"",""timeIn"":null,""timeOut"":null}]}"
2026-07-11,11:00,01:00,Double,17:00,609.75,"{""tips"":221.00,""location"":""Patio""}","{""tips"":388.75,""location"":""Main bar""}"
2026-07-12,11:00,20:00,Double,15:00,100,,"{""tips"":100.00}"
2026-07-13,12:00,18:00,Day,,50,"{""tips"":50.00}",
`;

test('csv: comments skipped, quoted commas and doubled quotes kept', () => {
  const s = parseCsv(staffCsv);
  assert.equal(s.length, 2);
  assert.equal(s[1]!.notes, 'sample, row');
  assert.equal(parseCsv(shiftsCsv)[0]!.day, '');
  assert.match(parseCsv(shiftsCsv)[0]!.night!, /^\{"tips":412\.00/);
});

test('brv-flat: portions, doubles split at the switchover, crew defaults to the shift times, you are on every crew', () => {
  const b = convertFlat({ shiftsCsv, staffCsv });
  assert.deepEqual(b.staff.map(p => [p.name, p.roles, p.status, p.is_user]), [['Ian', ['Head Bartender'], 'active', true], ['Mara', ['Bartender', 'Barback'], 'inactive', false]]);
  const eve = b.rows.find(r => r.date === '2026-07-03')!;
  assert.deepEqual([eve.start, eve.end, eve.tips, eve.notes, eve.shift_type], [960, 30, 412, 'Eve. Location: Main bar. Tags: busy', 'night']);
  assert.deepEqual(b.income[0], { id: 'bflat-2026-07-03-i1', shift_id: 'bflat-2026-07-03', category: 'Cash', amount: 40, note: 'door' });
  const crew = b.crew.filter(c => c.shift_id === eve.id).map(c => [c.name, c.start, c.end]);
  assert.deepEqual(crew, [['Mara', 960, 30], ['Ian', 960, 30]]);     // Mara had no times: the shift's own
  const day = b.rows.find(r => r.id === 'bflat-2026-07-11-day')!, night = b.rows.find(r => r.id === 'bflat-2026-07-11-night')!;
  assert.deepEqual([day.start, day.end, day.tips, night.start, night.end, night.tips], [660, 1020, 221, 1020, 60, 388.75]);
  const one = b.rows.filter(r => r.date === '2026-07-12');
  assert.equal(one.length, 1);                                       // a Double with one portion stays one shift
  assert.deepEqual([one[0]!.start, one[0]!.end, one[0]!.shift_type], [660, 1200, 'night']);
  assert.equal(b.rows.find(r => r.date === '2026-07-13')!.shift_type, 'day');
  assert.deepEqual(convertFlat({ shiftsCsv, staffCsv, skipDates: ['2026-07-03'] }).skipped, ['2026-07-03']);
});

test('brv-flat: income with no shift becomes a shift of its own, and you are not put on its crew', () => {
  const b = convertFlat({ shiftsCsv, staffCsv, unlinkedCsv });
  const s = b.rows.find(r => r.id === 'bflat-unlinked-ui_01')!;
  assert.deepEqual([s.date, s.start, s.end, s.tips, s.notes], ['2026-07-19', null, null, null, 'Income with no shift (brv-flat)']);
  assert.deepEqual(b.income.find(i => i.shift_id === s.id), { id: `${s.id}-i1`, shift_id: s.id, category: 'Venmo', amount: 85, note: 'deposit' });
  assert.equal(b.crew.filter(c => c.shift_id === s.id).length, 0);
});

/* ── shifts-YYYY-MM-DD.json export ── */
import { convertExport } from '../scripts/shiftsexport.mjs';

const me = { id: 'b2k-w1444', name: 'Ian', first: 'Ian', last: 'Streeper', roles: ['Bar'], id_number: 'E1444', manager: true };
const ex = (o = {}) => ({ id: 'x1', date: '2026-05-01', start: 1020, end: 150, tips: 385, notes: null, tags: [], location: null, party: false, partyName: null, shiftType: null, chump: null, ledger: [], ...o });

test('export: ids, times and tips carry over; a missing type follows the 3 PM rule; you are on the crew', () => {
  const b = convertExport({ me, shifts: [ex(), ex({ id: 'x2', date: '2026-05-02', start: 600, end: 1080, tips: 200 }), ex({ id: 'x3', date: '2026-05-03', start: 600, end: 1080, shiftType: 'Night' })] });
  assert.deepEqual(b.rows.map(r => [r.id, r.start, r.end, r.tips, r.shift_type]), [['x1', 1020, 150, 385, 'night'], ['x2', 600, 1080, 200, 'day'], ['x3', 600, 1080, 385, 'night']]);
  assert.deepEqual(b.staff.map(p => [p.name, p.is_user]), [['Ian', true]]);
  assert.deepEqual(b.crew.map(c => [c.shift_id, c.name, c.start, c.end]).slice(0, 1), [['x1', 'Ian', 1020, 150]]);
  assert.equal(convertExport({ shifts: [ex()] }).crew.length, 0);          // no "me": no crew invented
});

test('export: party becomes a flag; its details, location and tags go to the notes after the original text, without doubled periods', () => {
  const b = convertExport({ shifts: [ex({ notes: 'short drawer. ', party: true, partyName: 'Retirement, 40 ppl', location: 'Upper', tags: ['Promo', 'Event'] }), ex({ id: 'x2', party: true })] });
  assert.equal(b.rows[0]!.notes, 'short drawer. Party: Retirement, 40 ppl. Location: Upper. Tags: Promo, Event');
  assert.equal(b.rows[1]!.notes, null);                       // a bare party is the flag, not a note
  assert.deepEqual(b.rows.map(r => r.party), [true, true]);
  assert.equal(convertExport({ shifts: [ex()] }).rows[0]!.party, false);
});

test('export: Day + Night segments split into two shifts with their own tips; the same type twice stays one shift', () => {
  const two = ex({ id: 'd', tips: 220, start: 930, end: 1410, segments: [{ id: 'a', type: 'Day', boundary: 930, tips: 46 }, { id: 'b', type: 'Night', boundary: 1020, tips: 174 }] });
  const same = ex({ id: 'n', date: '2026-05-09', tips: 391, start: 1080, end: 130, segments: [{ id: 'a', type: 'Night', boundary: 1080, tips: 291 }, { id: 'b', type: 'Night', boundary: 1140, tips: 100 }] });
  const b = convertExport({ me, shifts: [two, same] });
  const d = b.rows.filter(r => r.id.startsWith('d'));
  assert.deepEqual(d.map(r => [r.id, r.shift_type, r.start, r.end, r.tips]), [['d', 'day', 930, 1020, 46], ['d-2', 'night', 1020, 1410, 174]]);
  assert.equal(b.crew.filter(c => c.shift_id === 'd-2')[0]!.start, 1020);
  const n = b.rows.filter(r => r.id === 'n');
  assert.equal(n.length, 1);
  assert.equal(n[0]!.tips, 391);
  assert.match(n[0]!.notes!, /Tips split: \$291 from 6:00p, \$100 from 7:00p/);
  assert.equal(b.rows.reduce((t, r) => t + (r.tips ?? 0), 0), 220 + 391);   // nothing lost or doubled
});

test('wages: brv2000 config wage table -> Wage rows, kept once on import, and skipped when that date already has one', () => {
  const b = convert({ config: { workers: [], wageRateTable: [{ effectiveDate: '2024-10-23', rate: 5 }, { effectiveDate: '2025-12-28', rate: 6 }] }, shifts: [] });
  assert.deepEqual(b.wages, [{ id: 'b2k-wage-2024-10-23', date: '2024-10-23', rate: 5, note: null }, { id: 'b2k-wage-2025-12-28', date: '2025-12-28', rate: 6, note: null }]);
  assert.deepEqual(wageOf({ effectiveDate: '2026-05-17', rate: 7 }).id, 'b2k-wage-2026-05-17');
  const plan = planImport(b as unknown as Bundle, none(), 1);
  assert.equal(plan.wages.length, 2);
  const again = planImport(b as unknown as Bundle, { ...none(), wageIds: new Set(plan.wages.map(w => w.id)), wageDates: new Set(plan.wages.map(w => w.date)) }, 2);
  assert.equal(again.wages.length, 0);
  const sameDay = planImport(b as unknown as Bundle, { ...none(), wageDates: new Set(['2025-12-28']) }, 3);
  assert.deepEqual(sameDay.wages.map(w => w.date), ['2024-10-23']);   // your own wage for that day stays
});
