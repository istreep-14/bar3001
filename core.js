/* core.js — pure logic shared by the browser app, Node tests, and Apps Script.
 * No I/O here. In Apps Script, paste this file as core.gs unchanged.
 *
 * Row (DB shape):
 *   { id, date:'YYYY-MM-DD', start:min|null, end:min|null, tips:number|null,
 *     notes:string|null, updated_at:ms, deleted:bool, other:number|null,
 *     shift_type:'day'|'night'|null }
 * `other` = legacy single non-tip amount. New entries go in the Income child table below;
 * `other` is kept (read-only in the UI) so old data still counts.
 * Derived values (hours, tips/hr, total) are never stored.
 *
 * Income row (child of a shift, linked by shift_id; zero to many per shift):
 *   { id, shift_id, category:one of CATEGORIES, amount:number, note:string|null,
 *     updated_at:ms, deleted:bool }
 * Times are integer minutes since midnight; end < start means past midnight.
 */
var COLS = ['id', 'date', 'start', 'end', 'tips', 'notes', 'updated_at', 'deleted', 'other', 'shift_type'];

var INCOME_COLS = ['id', 'shift_id', 'category', 'amount', 'note', 'updated_at', 'deleted'];
var CATEGORIES = ['Chump', 'Cash', 'Venmo', 'Consideration', 'Overtime'];

function blank(v) { return v === null || v === undefined || String(v).trim() === ''; }

function toMin(hhmm) {
  if (blank(hhmm)) return null;
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error('Bad time "' + hhmm + '" (use HH:MM)');
  return +m[1] * 60 + +m[2];
}

function toHHMM(min) {
  if (min === null || min === undefined) return '';
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

function hoursWorked(start, end) {
  if (start === null || end === null) return null;
  return ((end - start + 1440) % 1440) / 60;
}

/* Derived, never stored. Null when it can't be computed. */
function tipsPerHour(r) {
  var h = hoursWorked(r.start, r.end);
  return h && r.tips !== null && r.tips !== undefined ? r.tips / h : null;
}
/* income: array of this shift's live Income rows. */
function sumIncome(income) { return (income || []).reduce(function (t, i) { return t + i.amount; }, 0); }
function totalIncome(r, income) { return (r.tips || 0) + (r.other || 0) + sumIncome(income); }

/* Form seed only: 3pm or later = night. Stored value is whatever the user ends up with. */
function defaultShiftType(startMin) {
  return startMin === null || startMin === undefined ? null : (startMin >= 900 ? 'night' : 'day');
}

function toNum(v, field) {
  if (blank(v)) return null;
  var n = Number(v);
  if (isNaN(n)) throw new Error('Bad ' + field + ' "' + v + '"');
  return n;
}

function toBool(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; }

function validateRow(r) {
  if (!r || blank(r.id)) throw new Error('Missing id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) throw new Error('Bad date "' + r.date + '" (use YYYY-MM-DD)');
  ['start', 'end'].forEach(function (k) {
    var v = r[k];
    if (v !== null && (!Number.isInteger(v) || v < 0 || v >= 1440)) throw new Error('Bad ' + k + ' ' + v);
  });
  if (r.tips !== null && typeof r.tips !== 'number') throw new Error('Bad tips ' + r.tips);
  var other = r.other === undefined ? null : r.other;   // rows from before this column existed
  if (other !== null && typeof other !== 'number') throw new Error('Bad other ' + other);
  var type = r.shift_type === undefined ? null : r.shift_type;
  if (type !== null && type !== 'day' && type !== 'night') throw new Error('Bad shift_type ' + type + ' (day or night)');
  if (!Number.isFinite(r.updated_at)) throw new Error('Bad updated_at ' + r.updated_at);
  return {
    id: String(r.id), date: String(r.date), start: r.start, end: r.end, tips: r.tips,
    notes: blank(r.notes) ? null : String(r.notes), updated_at: r.updated_at, deleted: !!r.deleted, other: other, shift_type: type
  };
}

/* Case-insensitive match to the canonical category, so hand-typed "cash" works. */
function canonCategory(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].toLowerCase() === s) return CATEGORIES[i];
  return v;
}

function validateIncome(r) {
  if (!r || blank(r.id)) throw new Error('Missing id');
  if (blank(r.shift_id)) throw new Error('Missing shift_id');
  if (CATEGORIES.indexOf(r.category) < 0) throw new Error('Bad category "' + r.category + '" (' + CATEGORIES.join(', ') + ')');
  if (typeof r.amount !== 'number' || !isFinite(r.amount)) throw new Error('Bad amount ' + r.amount);
  if (!Number.isFinite(r.updated_at)) throw new Error('Bad updated_at ' + r.updated_at);
  return { id: String(r.id), shift_id: String(r.shift_id), category: r.category, amount: r.amount,
    note: blank(r.note) ? null : String(r.note), updated_at: r.updated_at, deleted: !!r.deleted };
}

function incomeToSheet(r) {
  return [r.id, r.shift_id, r.category, r.amount, r.note || '', r.updated_at, !!r.deleted];
}

function sheetToIncome(a) {
  return validateIncome({
    id: blank(a[0]) ? '' : String(a[0]).trim(),
    shift_id: blank(a[1]) ? '' : String(a[1]).trim(),
    category: canonCategory(a[2]),
    amount: toNum(a[3], 'amount'),
    note: blank(a[4]) ? null : String(a[4]),
    updated_at: toNum(a[5], 'updated_at'),
    deleted: toBool(a[6])
  });
}

function rowToSheet(r) {
  return [r.id, r.date, toHHMM(r.start), toHHMM(r.end),
    r.tips === null ? '' : r.tips, r.notes || '', r.updated_at, !!r.deleted,
    r.other === null || r.other === undefined ? '' : r.other,
    r.shift_type || ''];
}

function sheetToRow(a) {
  return validateRow({
    id: blank(a[0]) ? '' : String(a[0]).trim(),
    date: String(a[1]).trim(),
    start: toMin(a[2]), end: toMin(a[3]),
    tips: toNum(a[4], 'tips'),
    notes: blank(a[5]) ? null : String(a[5]),
    updated_at: toNum(a[6], 'updated_at'),
    deleted: toBool(a[7]),
    other: toNum(a[8], 'other'),
    shift_type: blank(a[9]) ? null : String(a[9]).trim().toLowerCase()
  });
}

/* Last-write-wins. Tie keeps current, so identical stamps never flip-flop. */
function pickNewer(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming.updated_at > current.updated_at ? incoming : current;
}

/* Server side: merge incoming rows into a {id: row} map.
 * Returns ids where the incoming row won (these need writing to the Sheet). */
function mergeInto(map, incoming) {
  var changed = [];
  incoming.forEach(function (r) {
    if (pickNewer(map[r.id], r) === r && map[r.id] !== r) { map[r.id] = r; changed.push(r.id); }
  });
  return changed;
}

/* Client side, after a sync: server returns the complete merged set.
 * - Server row wins unless the local copy is dirty AND newer (edited mid-flight).
 * - Local rows missing from the server are dropped (deleted in the Sheet),
 *   unless dirty (created mid-flight or rejected — kept for retry).
 * - Ids in heldIds (Sheet row has a typo) are left exactly as they are locally.
 * local: {id: row with _dirty flag}; returns a new map. */
function reconcileClient(local, serverRows, heldIds) {
  var held = {};
  (heldIds || []).forEach(function (id) { held[id] = true; });
  var out = {};
  serverRows.forEach(function (s) {
    var l = local[s.id];
    out[s.id] = (l && l._dirty && l.updated_at > s.updated_at) ? l : Object.assign({}, s, { _dirty: false });
  });
  Object.keys(local).forEach(function (id) {
    if (!out[id] && (local[id]._dirty || held[id])) out[id] = local[id];
  });
  return out;
}

function stripLocal(r) { var c = Object.assign({}, r); delete c._dirty; return c; }

if (typeof module !== 'undefined') {
  module.exports = { COLS: COLS, INCOME_COLS: INCOME_COLS, CATEGORIES: CATEGORIES, sumIncome: sumIncome,
    validateIncome: validateIncome, incomeToSheet: incomeToSheet, sheetToIncome: sheetToIncome, toMin: toMin, toHHMM: toHHMM, hoursWorked: hoursWorked, defaultShiftType: defaultShiftType, tipsPerHour: tipsPerHour, totalIncome: totalIncome,
    validateRow: validateRow, rowToSheet: rowToSheet, sheetToRow: sheetToRow,
    pickNewer: pickNewer, mergeInto: mergeInto, reconcileClient: reconcileClient, stripLocal: stripLocal };
}
