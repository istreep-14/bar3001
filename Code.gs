/* Code.gs — Sheet side. Requires core.gs (a copy of core.js) in the same project.
 * Two tabs: Shifts (parent) and Income (child rows linked by shift_id). */

/* A function, not a var, so it doesn't depend on core.gs loading first. */
function tables() {
  return [
    { name: 'Shifts', key: 'rows', cols: COLS, parse: sheetToRow, toSheet: rowToSheet,
      stamp: 7, del: 8, fix: fixShiftCells },
    { name: 'Income', key: 'income', cols: INCOME_COLS, parse: sheetToIncome, toSheet: incomeToSheet,
      stamp: 6, del: 7, fix: function (v) {} }
  ];
}

function fixShiftCells(v, tz) {
  if (v[1] instanceof Date) v[1] = Utilities.formatDate(v[1], tz, 'yyyy-MM-dd');
  if (v[2] instanceof Date) v[2] = Utilities.formatDate(v[2], tz, 'HH:mm');
  if (v[3] instanceof Date) v[3] = Utilities.formatDate(v[3], tz, 'HH:mm');
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
  var shifts = ss.getSheetByName('Shifts'), inc = ss.getSheetByName('Income');
  shifts.getRange('A:D').setNumberFormat('@');   // keep id/date/times as text, not auto-dates
  shifts.getRange('F:F').setNumberFormat('@');
  shifts.getRange('G:G').setNumberFormat('0');
  inc.getRange('A:C').setNumberFormat('@');
  inc.getRange('F:F').setNumberFormat('0');
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
  var ids = [], stamps = [], dels = [];
  vals.forEach(function (v) {
    var empty = v.every(function (x, i) { return i === 0 || i === si || i === di || x === ''; });
    ids.push([v[0] || (empty ? '' : Utilities.getUuid())]);
    stamps.push([empty && !v[0] ? '' : now]);
    dels.push([v[di] === '' && !empty ? false : v[di]]);
  });
  sh.getRange(first, 1, n, 1).setValues(ids);
  sh.getRange(first, t.stamp, n, 1).setValues(stamps);
  sh.getRange(first, t.del, n, 1).setValues(dels);
}

/* POST { token, rows: [...shifts], income: [...] }
 *   -> { ok, rows, income: <complete merged sets>, held, held_income: [ids], errors } */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
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
        try { incoming.push(t.key === 'rows' ? validateRow(r) : validateIncome(r)); }
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
      out[t.key === 'rows' ? 'held' : 'held_income'] = Object.keys(state.held);
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
