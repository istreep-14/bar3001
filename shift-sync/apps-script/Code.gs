/* Code.gs — Sheet side. Requires core.gs (a copy of core.js) in the same project.
 * Six tabs: Shifts (parent), Income and Crew (child rows linked by shift_id), Staff (the employee roster),
 * Wages (your hourly wage by effective date), Roles (each role's colour, icon and rank). Crew is the hub between Shifts and Staff: one row per bartender per shift,
 * with their start, end and hours. */

/* A function, not a var, so it doesn't depend on core.gs loading first. */
function tables() {
  return [
    { name: 'Shifts', key: 'rows', cols: COLS, parse: sheetToRow, toSheet: rowToSheet,
      stamp: 7, del: 8, fix: fixShiftCells, validate: validateRow, held: 'held' },
    { name: 'Income', key: 'income', cols: INCOME_COLS, parse: sheetToIncome, toSheet: incomeToSheet,
      stamp: 6, del: 7, fix: function (v) {}, validate: validateIncome, held: 'held_income' },
    { name: 'Staff', key: 'staff', cols: STAFF_COLS, parse: sheetToStaff, toSheet: staffToSheet,
      stamp: 11, del: 12, fix: function (v) {}, validate: validateStaff, held: 'held_staff' },
    { name: 'Crew', key: 'crew', cols: CREW_COLS, parse: sheetToCrew, toSheet: crewToSheet,
      stamp: 7, del: 8, fix: fixCrewCells, validate: validateCrew, held: 'held_crew', recalc: crewHoursCell },
    { name: 'Wages', key: 'wages', cols: WAGE_COLS, parse: sheetToWage, toSheet: wageToSheet,
      stamp: 5, del: 6, fix: fixWageCells, validate: validateWage, held: 'held_wages' },
    { name: 'Roles', key: 'roles', cols: ROLE_COLS, parse: sheetToRole, toSheet: roleToSheet,
      stamp: 6, del: 7, fix: function (v) {}, validate: validateRole, held: 'held_roles' }
  ];
}

function fixShiftCells(v, tz) {
  if (v[1] instanceof Date) v[1] = Utilities.formatDate(v[1], tz, 'yyyy-MM-dd');
  if (v[2] instanceof Date) v[2] = Utilities.formatDate(v[2], tz, 'HH:mm');
  if (v[3] instanceof Date) v[3] = Utilities.formatDate(v[3], tz, 'HH:mm');
}

function fixCrewCells(v, tz) {
  if (v[4] instanceof Date) v[4] = Utilities.formatDate(v[4], tz, 'HH:mm');
  if (v[5] instanceof Date) v[5] = Utilities.formatDate(v[5], tz, 'HH:mm');
}

function fixWageCells(v, tz) {
  if (v[1] instanceof Date) v[1] = Utilities.formatDate(v[1], tz, 'yyyy-MM-dd');
}

/* Crew's last column is derived from its start and end. Rewritten whenever a row is edited by hand. */
function crewHoursCell(v, tz) {
  var c = v.slice();
  fixCrewCells(c, tz);
  try { var h = hoursWorked(toMin(c[4]), toMin(c[5])); return h === null ? '' : Math.round(h * 100) / 100; }
  catch (err) { return ''; }
}

function ensureSheet(t) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(t.name) || ss.insertSheet(t.name);
  if (sh.getLastRow() === 0) sh.appendRow(t.cols);
  return sh;
}

/* Run once from the editor. Non-destructive: never clears data. Logs your TOKEN.
 * Safe to re-run after updating the code: adds newer columns/tabs. */
function setup() {
  tables().forEach(function (t) {
    var sh = ensureSheet(t);
    sh.getRange(1, 1, 1, t.cols.length).setValues([t.cols]);
    sh.setFrozenRows(1);
  });
  var ss = SpreadsheetApp.getActive();
  var shifts = ss.getSheetByName('Shifts'), inc = ss.getSheetByName('Income'), staff = ss.getSheetByName('Staff'), crew = ss.getSheetByName('Crew'), wages = ss.getSheetByName('Wages');
  shifts.getRange('A:D').setNumberFormat('@');   // keep id/date/times as text, not auto-dates
  shifts.getRange('F:F').setNumberFormat('@');
  shifts.getRange('G:G').setNumberFormat('0');
  inc.getRange('A:C').setNumberFormat('@');
  inc.getRange('F:F').setNumberFormat('0');
  staff.getRange('A:F').setNumberFormat('@');   // ids like E0621 stay text
  staff.getRange('K:K').setNumberFormat('0');
  staff.getRange('M:Q').setNumberFormat('@');   // aliases, photo, avatar colour and text, main role stay text
  var roles = ss.getSheetByName('Roles');
  roles.getRange('A:D').setNumberFormat('@');
  roles.getRange('F:F').setNumberFormat('0');
  crew.getRange('A:F').setNumberFormat('@');    // ids and HH:MM times stay text
  crew.getRange('G:G').setNumberFormat('0');
  crew.getRange('I:I').setNumberFormat('0.00');
  wages.getRange('A:B').setNumberFormat('@');   // ids and YYYY-MM-DD dates stay text
  wages.getRange('E:E').setNumberFormat('0');
  inc.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(CATEGORIES, true).setAllowInvalid(false).build());
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TOKEN')) p.setProperty('TOKEN', Utilities.getUuid());
  Logger.log('TOKEN: ' + p.getProperty('TOKEN'));
}

/* Stamps updated_at (and an id for new rows) on manual Sheet edits,
 * so Sheet edits take part in last-write-wins. Doesn't fire for script writes. */
function onEdit(e) {
  var sh = e.range.getSheet();
  var t = tables().filter(function (x) { return x.name === sh.getName(); })[0];
  if (!t) return;
  var first = Math.max(e.range.getRow(), 2);
  var last = e.range.getRow() + e.range.getNumRows() - 1;
  if (last < first) return;
  var n = last - first + 1, si = t.stamp - 1, di = t.del - 1;
  var vals = sh.getRange(first, 1, n, t.cols.length).getValues();
  var now = Date.now();
  /* A row copied and pasted keeps its id, and two rows with one id overwrite each other. A paste covers the id column
   * where typing into a cell doesn't, so a pasted row whose id is already on another row gets a new one; a row you
   * edit cell by cell keeps its own. */
  var pasted = e.range.getColumn() === 1, taken = {};
  if (pasted && sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (x, k) {
      if (x[0] !== '' && (k + 2 < first || k + 2 > last)) taken[String(x[0]).trim()] = true;
    });
  }
  var ids = [], stamps = [], dels = [];
  vals.forEach(function (v) {
    var empty = v.every(function (x, i) { return i === 0 || i === si || i === di || x === ''; });
    var id = v[0] === '' ? '' : String(v[0]).trim();
    if (id && taken[id]) id = '';   // a copy of another row: a row of its own from now on
    if (!id && !empty) id = Utilities.getUuid();
    if (pasted && id) taken[id] = true;   // the same row pasted twice in one go
    ids.push([id]);
    stamps.push([empty && !v[0] ? '' : now]);
    dels.push([v[di] === '' && !empty ? false : v[di]]);
  });
  sh.getRange(first, 1, n, 1).setValues(ids);
  sh.getRange(first, t.stamp, n, 1).setValues(stamps);
  sh.getRange(first, t.del, n, 1).setValues(dels);
  if (t.recalc) {
    var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    sh.getRange(first, t.cols.length, n, 1).setValues(vals.map(function (v) { return [t.recalc(v, tz)]; }));
  }
}

/* POST { token, rows: [...shifts], income: [...], staff: [...], crew: [...], wages: [...], roles: [...] }
 *   -> { ok, rows, income, staff, crew, wages, roles: <complete merged sets>, held, held_income, held_staff, held_crew, held_wages, held_roles: [ids], errors }
 * A missing key is treated as an empty list, so an older app still works. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  // Another device's sync holds the lock: say so as data, not as an error page the app can't read.
  if (!lock.tryLock(15000)) return json({ error: 'The Sheet is busy with another sync. It will try again.' });
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== PropertiesService.getScriptProperties().getProperty('TOKEN')) {
      return json({ error: 'auth' });
    }
    var errors = [], out = { ok: true };
    tables().forEach(function (t) {
      var sh = ensureSheet(t);
      var state = readAll(sh, t);
      state.errors.forEach(function (x) { x.table = t.name; errors.push(x); });

      var incoming = [];
      (body[t.key] || []).forEach(function (r) {
        if (r && state.held[r.id]) {   // don't append a duplicate of a row that has a typo
          errors.push({ table: t.name, source: 'app', id: r.id, error: 'Fix ' + t.name + ' row ' + state.held[r.id] + ' first' });
          return;
        }
        try { incoming.push(t.validate(r)); }
        catch (err) { errors.push({ table: t.name, source: 'app', id: r && r.id, error: err.message }); }
      });

      var changed = mergeInto(state.map, incoming);
      var appends = [];
      changed.forEach(function (id) {
        var vals = t.toSheet(state.map[id]);
        if (state.rowNum[id]) sh.getRange(state.rowNum[id], 1, 1, vals.length).setValues([vals]);
        else appends.push(vals);
      });
      if (appends.length) {
        sh.getRange(sh.getLastRow() + 1, 1, appends.length, t.cols.length).setValues(appends);
      }
      out[t.key] = Object.keys(state.map).map(function (id) { return state.map[id]; });
      out[t.held] = Object.keys(state.held);
    });
    out.errors = errors;
    return json(out);
  } catch (err) {
    return json({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* Reads every data row. Bad rows are reported, not fatal — one typo in the
 * Sheet shouldn't block syncing everything else. */
function readAll(sh, t) {
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var values = sh.getDataRange().getValues();
  var map = {}, rowNum = {}, held = {}, errors = [];
  for (var i = 1; i < values.length; i++) {
    var v = values[i].slice(0, t.cols.length);
    while (v.length < t.cols.length) v.push('');   // sheet created before newer columns
    if (v.every(function (x) { return x === ''; })) continue;
    t.fix(v, tz);
    try {
      var r = t.parse(v);
      if (rowNum[r.id] || held[r.id]) {
        /* One id on two rows (a copy pasted before this script gave copies their own id): neither is taken, so neither
         * overwrites the other, and the app keeps its own copy until the Sheet says which is which. */
        var other = rowNum[r.id] || held[r.id];
        errors.push({ source: 'sheet', row: i + 1, error: 'Same id as row ' + other + ': a copied row keeps its id. Clear the id on the copy and it gets a new one.' });
        delete map[r.id]; delete rowNum[r.id];
        held[r.id] = other;
        continue;
      }
      map[r.id] = r;
      rowNum[r.id] = i + 1;
    } catch (err) {
      if (v[0] !== '') held[String(v[0]).trim()] = i + 1;
      errors.push({ source: 'sheet', row: i + 1, error: err.message });
    }
  }
  return { map: map, rowNum: rowNum, held: held, errors: errors };
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
