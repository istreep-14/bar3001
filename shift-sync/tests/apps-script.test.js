// Runs the deployed Apps Script files (Code.gs + generated core.gs) in a sandbox with a fake in-memory Sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fakeSheet(name, header, rows) {
  const grid = [header, ...rows];
  const range = (r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr }, (_, i) =>
      Array.from({ length: nc }, (_, j) => (grid[r - 1 + i] || [])[c - 1 + j] ?? '')),
    setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => {
      grid[r - 1 + i] = grid[r - 1 + i] || Array(header.length).fill('');
      grid[r - 1 + i][c - 1 + j] = x;
    })),
    getRow: () => r, getNumRows: () => nr, getSheet: () => sheet
  });
  const sheet = {
    getName: () => name,
    getDataRange: () => range(1, 1, grid.length, header.length),
    getRange: (r, c, nr = 1, nc = 1) => range(r, c, nr, nc),
    getLastRow: () => grid.length,
    appendRow: (v) => grid.push(v)
  };
  return { grid, sheet };
}

function harness(initialRows = [], incomeRows = [], staffRows = [], crewRows = [], wageRows = []) {
  const S = fakeSheet('Shifts', ['id', 'date', 'start', 'end', 'tips', 'notes', 'updated_at', 'deleted', 'other', 'shift_type', 'party'], initialRows);
  const I = fakeSheet('Income', ['id', 'shift_id', 'category', 'amount', 'note', 'updated_at', 'deleted'], incomeRows);
  const St = fakeSheet('Staff', ['id', 'name', 'first', 'last', 'roles', 'id_number', 'manager', 'is_user', 'status', 'notes', 'updated_at', 'deleted'], staffRows);
  const C = fakeSheet('Crew', ['id', 'shift_id', 'staff_id', 'name', 'start', 'end', 'updated_at', 'deleted', 'hours'], crewRows);
  const W = fakeSheet('Wages', ['id', 'date', 'rate', 'note', 'updated_at', 'deleted'], wageRows);
  const { grid, sheet } = S;
  const sheets = { Shifts: sheet, Income: I.sheet, Staff: St.sheet, Crew: C.sheet, Wages: W.sheet };
  let uuid = 0;
  const ctx = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => sheets[n], getSpreadsheetTimeZone: () => 'UTC' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'T' }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }) },
    Utilities: { getUuid: () => 'gen' + (++uuid), formatDate: (d, tz, pattern) => (pattern === 'HH:mm' ? d.toISOString().slice(11, 16) : d.toISOString().slice(0, 10)) },
    Date, JSON, Object, Number, String, Math, Array
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(import.meta.dirname + '/../apps-script/core.gs', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(import.meta.dirname + '/../apps-script/Code.gs', 'utf8'), ctx);
  const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  return { grid, post, ctx, sheet, income: I.grid, incomeSheet: I.sheet, staff: St.grid, crew: C.grid, wages: W.grid, crewSheet: C.sheet };
}

const row = (o = {}) => ({ id: 'a', date: '2026-09-25', start: 1080, end: 120, tips: 240,
  notes: null, updated_at: 1000, deleted: false, other: 50, shift_type: 'night', party: false, ...o });

test('rejects wrong token', () => {
  assert.equal(harness().post({ token: 'x', rows: [] }).error, 'auth');
});

test('appends new rows in Sheet format and returns full set', () => {
  const h = harness();
  const res = h.post({ token: 'T', rows: [row()] });
  assert.equal(res.ok, true);
  assert.deepEqual(h.grid[1], ['a', '2026-09-25', '18:00', '02:00', 240, '', 1000, false, 50, 'night', false]);
  assert.equal(res.rows.length, 1);
});

test('newer app edit overwrites Sheet row in place; older is ignored', () => {
  const h = harness([['a', '2026-09-25', '18:00', '02:00', 100, '', 500, false]]);
  h.post({ token: 'T', rows: [row({ tips: 300, updated_at: 900 })] });
  assert.equal(h.grid[1][4], 300);
  assert.equal(h.grid.length, 2);
  h.post({ token: 'T', rows: [row({ tips: 1, updated_at: 100 })] });
  assert.equal(h.grid[1][4], 300);
});

test('newer Sheet edit wins and is returned to the app', () => {
  const h = harness([['a', '2026-09-25', '18:00', '02:00', 999, 'fixed', 5000, false]]);
  const res = h.post({ token: 'T', rows: [row({ updated_at: 1000 })] });
  assert.equal(h.grid[1][4], 999);
  assert.equal(res.rows[0].tips, 999);
});

test('Sheet typo is reported and held, not duplicated', () => {
  const h = harness([['a', '2026-09-25', '6pm', '02:00', 100, '', 500, false]]);
  const res = h.post({ token: 'T', rows: [row({ updated_at: 9999 })] });
  assert.equal(h.grid.length, 2);
  assert.deepEqual(res.held, ['a']);
  assert.equal(res.errors.length, 2);
});

test('onEdit stamps id and updated_at on manual rows, skips blank rows', () => {
  const h = harness([['', '2026-09-26', '17:00', '01:00', 80, '', '', ''], ['', '', '', '', '', '', '', '']]);
  h.ctx.onEdit({ range: h.sheet.getRange(2, 2, 2, 1) });
  assert.equal(h.grid[1][0], 'gen1');
  assert.ok(h.grid[1][6] > 0);
  assert.equal(h.grid[1][7], false);
  assert.equal(h.grid[2][0], '');
  assert.equal(h.grid[2][6], '');
});

const inc = (o = {}) => ({ id: 'i1', shift_id: 'a', category: 'Cash', amount: 40, note: null, updated_at: 1000, deleted: false, ...o });

test('income rows append to the Income tab and come back with the full set', () => {
  const h = harness();
  const res = h.post({ token: 'T', rows: [row()], income: [inc(), inc({ id: 'i2', category: 'Venmo', amount: 15, note: 'Sam' })] });
  assert.equal(res.ok, true);
  assert.deepEqual(h.income[1], ['i1', 'a', 'Cash', 40, '', 1000, false]);
  assert.deepEqual(h.income[2], ['i2', 'a', 'Venmo', 15, 'Sam', 1000, false]);
  assert.equal(res.income.length, 2);
  assert.equal(res.rows.length, 1);
});

test('income last-write-wins and soft delete propagate', () => {
  const h = harness([], [['i1', 'a', 'Cash', 40, '', 500, false]]);
  h.post({ token: 'T', income: [inc({ amount: 60, updated_at: 900 })] });
  assert.equal(h.income[1][3], 60);
  h.post({ token: 'T', income: [inc({ amount: 1, updated_at: 100 })] });
  assert.equal(h.income[1][3], 60);
  h.post({ token: 'T', income: [inc({ deleted: true, updated_at: 2000 })] });
  assert.equal(h.income[1][6], true);
});

test('bad category is rejected; hand-typed lowercase category is accepted', () => {
  const h = harness([], [['i9', 'a', 'venmo', 5, '', 500, false]]);
  const res = h.post({ token: 'T', income: [inc({ category: 'Gift' })] });
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].table, 'Income');
  assert.equal(res.income[0].category, 'Venmo');
});

test('onEdit on the Income tab stamps id and updated_at', () => {
  const h = harness([], [['', 'a', 'Cash', 20, '', '', '']]);
  h.ctx.onEdit({ range: h.incomeSheet.getRange(2, 4, 1, 1) });
  assert.equal(h.income[1][0], 'gen1');
  assert.ok(h.income[1][5] > 0);
  assert.equal(h.income[1][6], false);
});

const person = (o = {}) => ({ id: 'p1', name: 'Abby', first: 'Abby', last: 'Clemens', roles: ['Bartender', 'Server'], id_number: 'E1292',
  manager: false, is_user: false, status: 'active', notes: null, updated_at: 1000, deleted: false, ...o });

test('staff rows append to the Staff tab (roles in one cell) and come back with the full set', () => {
  const h = harness();
  const res = h.post({ token: 'T', rows: [], income: [], staff: [person()] });
  assert.deepEqual(h.staff[1], ['p1', 'Abby', 'Abby', 'Clemens', 'Bartender, Server', 'E1292', false, false, 'active', '', 1000, false]);
  assert.deepEqual(res.staff, [person()]);
  assert.deepEqual(res.held_staff, []);
});

test('staff last-write-wins and soft delete propagate; a hand-typed roles cell is split', () => {
  const h = harness([], [], [['p1', 'Abby', '', '', 'Server,  Barback', 'E1', 'TRUE', '', '', '', 500, false]]);
  const res = h.post({ token: 'T', rows: [], income: [], staff: [person({ updated_at: 900, deleted: true })] });
  assert.equal(h.staff[1][11], true);
  assert.equal(h.staff.length, 2);
  assert.deepEqual(res.staff[0].roles, ['Bartender', 'Server']);   // the newer app edit won
  const h2 = harness([], [], [['p1', 'Abby', '', '', 'Server,  Barback', 'E1', 'TRUE', '', '', '', 500, false]]);
  const r2 = h2.post({ token: 'T', rows: [], income: [] });
  assert.deepEqual(r2.staff[0].roles, ['Server', 'Barback']);
  assert.equal(r2.staff[0].manager, true);
  assert.equal(r2.staff[0].status, 'active');           // a blank status cell means active
});

test('a staff row with no name is reported and held; an old app that sends no staff still works', () => {
  const h = harness([], [], [['p2', '', '', '', '', '', '', '', 'active', '', 5, false]]);
  const res = h.post({ token: 'T', rows: [] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.held_staff, ['p2']);
  assert.match(res.errors.find(e => e.table === 'Staff').error, /Missing name/);
  const bad = h.post({ token: 'T', staff: [person({ status: 'retired' })] });
  assert.match(bad.errors.find(e => e.source === 'app').error, /Bad status/);
});

const member = (o = {}) => ({ id: 'c1', shift_id: 'a', staff_id: 'p1', name: 'Abby', start: 1080, end: 120, updated_at: 1000, deleted: false, ...o });

test('crew rows append to the Crew tab with HH:MM times and the roster name, and come back as a full set', () => {
  const h = harness();
  const res = h.post({ token: 'T', rows: [row()], crew: [member(), member({ id: 'c2', staff_id: 'me', name: 'Ian', start: 1020, end: null })] });
  assert.deepEqual(h.crew[1], ['c1', 'a', 'p1', 'Abby', '18:00', '02:00', 1000, false, 8]);      // hours: derived, for whoever reads the Sheet
  assert.deepEqual(h.crew[2], ['c2', 'a', 'me', 'Ian', '17:00', '', 1000, false, '']);
  assert.equal(res.crew.length, 2);
  assert.deepEqual(res.held_crew, []);
});

test('crew last-write-wins; a Sheet time cell that became a Date is read back as HH:MM; a bad row is held', () => {
  const h = harness([], [], [], [['c1', 'a', 'p1', 'Abby', new Date('1970-01-01T19:30:00Z'), '01:00', 500, false]]);
  const res = h.post({ token: 'T', crew: [member({ updated_at: 400, end: 0 })] });   // older app edit loses
  assert.equal(res.crew[0].start, 1170);
  assert.equal(res.crew[0].end, 60);
  const bad = harness([], [], [], [['c9', 'a', '', 'x', '18:00', '02:00', 5, false]]).post({ token: 'T' });
  assert.deepEqual(bad.held_crew, ['c9']);
  assert.match(bad.errors.find(e => e.table === 'Crew').error, /Missing staff_id/);
});

test('wages: rows append to the Wages tab, a Date cell reads back as YYYY-MM-DD, a bad rate is held, an older app sending none still works', () => {
  const h = harness();
  const res = h.post({ token: 'T', wages: [{ id: 'w1', date: '2024-10-23', rate: 5, note: null, updated_at: 1, deleted: false }] });
  assert.deepEqual(h.wages[1], ['w1', '2024-10-23', 5, '', 1, false]);
  assert.equal(res.wages.length, 1);
  assert.deepEqual(res.held_wages, []);
  const h2 = harness([], [], [], [], [['w2', new Date('2025-12-28T00:00:00Z'), 6, '', 5, false], ['w3', '2026-05-17', 'lots', '', 5, false]]);
  const r2 = h2.post({ token: 'T', rows: [] });
  assert.equal(r2.wages.find(w => w.id === 'w2').date, '2025-12-28');
  assert.deepEqual(r2.held_wages, ['w3']);
  assert.match(r2.errors.find(e => e.table === 'Wages').error, /Bad rate/);
});

test('a hand edit of a Crew start or end refreshes its hours cell', () => {
  const h = harness([], [], [], [['c1', 'a', 'p1', 'Abby', '18:00', '22:30', 500, false, 99]]);
  h.ctx.onEdit({ range: { getSheet: () => h.crewSheet, getRow: () => 2, getNumRows: () => 1 } });
  assert.equal(h.crew[1][8], 4.5);
});
