/* core.js — pure logic shared by the browser app, Node tests, and Apps Script.
 * No I/O here. In Apps Script, paste this file as core.gs unchanged.
 *
 * Row (DB shape):
 *   { id, date:'YYYY-MM-DD', start:min|null, end:min|null, tips:number|null,
 *     notes:string|null, updated_at:ms, deleted:bool, other:number|null,
 *     shift_type:'day'|'night'|null, party:bool }
 * `party` = a party (private event) happened on the shift. Missing on older rows = false.
 * `other` = legacy single non-tip amount. New entries go in the Income child table below;
 * `other` is kept (read-only in the UI) so old data still counts.
 * Derived values (hours, tips/hr, total) are never stored.
 *
 * Income row (child of a shift, linked by shift_id; zero to many per shift):
 *   { id, shift_id, category:one of CATEGORIES, amount:number, note:string|null,
 *     updated_at:ms, deleted:bool }
 * Staff row (the employee roster; identity only, no activity):
 *   { id, name (the unique handle), first, last, roles:[string], id_number, manager:bool, is_user:bool,
 *     status:'active'|'inactive', notes, updated_at:ms, deleted:bool,
 *     aliases:[string] (other names they go by, matched when a name is typed), photo:string|null (a small
 *     data:image URL), avatar_color:string|null ('#rrggbb' or a palette name), avatar_text:string|null (1 to 3 characters),
 *     role:string|null (their main role; `roles` then holds only the others) }
 *   In the Sheet, roles and aliases are one cell each, comma-separated. The columns from aliases on come after `deleted`,
 *   so a Staff tab from before them still reads. A row from before `role` has it null, and its first role reads as the main one.
 * Role row (the roles people can have, each with a colour and an icon, in rank order like a server's role list):
 *   { id, name (unique, what a Staff row's role/roles hold), color:string|null ('#rrggbb' or a palette name),
 *     icon:string|null (an icon name the app draws), sort:number (lower ranks first), updated_at:ms, deleted:bool }
 * Crew row (child of a shift, linked by shift_id; one per bartender who worked it, including you):
 *   { id, shift_id, staff_id, name:string|null (snapshot of the roster name, so the Sheet reads),
 *     start:min|null, end:min|null, updated_at:ms, deleted:bool }
 *   A person appears at most once per shift. Their hours are derived from start/end, never stored.
 * Wage row (an hourly wage from your employer, in effect from `date` until the next row's date):
 *   { id, date:'YYYY-MM-DD', rate:number (per hour), note:string|null, updated_at:ms, deleted:bool }
 *   A shift's wage is estimated, never stored: its hours times the rate in effect on its date.
 * Times are integer minutes since midnight; end < start means past midnight.
 */
var COLS = ['id', 'date', 'start', 'end', 'tips', 'notes', 'updated_at', 'deleted', 'other', 'shift_type', 'party'];

var INCOME_COLS = ['id', 'shift_id', 'category', 'amount', 'note', 'updated_at', 'deleted'];
var CATEGORIES = ['Chump', 'Cash', 'Venmo', 'Consideration', 'Overtime'];

var STAFF_COLS = ['id', 'name', 'first', 'last', 'roles', 'id_number', 'manager', 'is_user', 'status', 'notes', 'updated_at', 'deleted',
  'aliases', 'photo', 'avatar_color', 'avatar_text', 'role'];
var ROLE_COLS = ['id', 'name', 'color', 'icon', 'sort', 'updated_at', 'deleted'];
/* A colour a person's avatar or a role can take: a hex, or the name of one of the app's palette colours. */
var COLOR_RE = /^#[0-9a-fA-F]{6}$|^[a-z][a-z-]{0,23}$/;
/* A photo is stored in its Sheet cell, and a cell holds 50,000 characters. */
var PHOTO_MAX = 45000;

/* `hours` is the last column: a readable, derived figure for whoever reads the Sheet. Written by the script, ignored on read. */
var CREW_COLS = ['id', 'shift_id', 'staff_id', 'name', 'start', 'end', 'updated_at', 'deleted', 'hours'];
var WAGE_COLS = ['id', 'date', 'rate', 'note', 'updated_at', 'deleted'];

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
/* wage: the shift's estimated wage (see wageFor); optional so older callers still work. */
function totalIncome(r, income, wage) { return (r.tips || 0) + (r.other || 0) + sumIncome(income) + (wage || 0); }

/* rates: live Wage rows in any order. The rate in effect on `date` is the latest one starting on or before it;
 * null before the first. */
function wageRateFor(rates, date) {
  var best = null;
  (rates || []).forEach(function (r) { if (r.date <= date && (best === null || r.date > best.date)) best = r; });
  return best ? best.rate : null;
}
/* Estimated wage for a shift: its hours times the rate in effect that day. Null without hours or a rate. */
function wageFor(rates, date, hours) {
  var rate = wageRateFor(rates, date);
  return hours === null || hours === undefined || rate === null ? null : hours * rate;
}

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
    notes: blank(r.notes) ? null : String(r.notes), updated_at: r.updated_at, deleted: !!r.deleted, other: other, shift_type: type,
    party: !!r.party
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

/* crew: array of this shift's live Crew rows. Rows without both times count as a person, not hours. */
function crewHours(crew) {
  return (crew || []).reduce(function (t, c) { return t + (hoursWorked(c.start, c.end) || 0); }, 0);
}

function validateCrew(r) {
  if (!r || blank(r.id)) throw new Error('Missing id');
  if (blank(r.shift_id)) throw new Error('Missing shift_id');
  if (blank(r.staff_id)) throw new Error('Missing staff_id');
  var t = {};
  ['start', 'end'].forEach(function (k) {
    var v = r[k] === undefined ? null : r[k];
    if (v !== null && (!Number.isInteger(v) || v < 0 || v >= 1440)) throw new Error('Bad ' + k + ' ' + v);
    t[k] = v;
  });
  if (!Number.isFinite(r.updated_at)) throw new Error('Bad updated_at ' + r.updated_at);
  return { id: String(r.id), shift_id: String(r.shift_id), staff_id: String(r.staff_id),
    name: blank(r.name) ? null : String(r.name).trim(), start: t.start, end: t.end,
    updated_at: r.updated_at, deleted: !!r.deleted };
}

function crewToSheet(r) {
  var h = hoursWorked(r.start, r.end);
  return [r.id, r.shift_id, r.staff_id, r.name || '', toHHMM(r.start), toHHMM(r.end), r.updated_at, !!r.deleted, h === null ? '' : Math.round(h * 100) / 100];
}

function sheetToCrew(a) {
  return validateCrew({
    id: blank(a[0]) ? '' : String(a[0]).trim(),
    shift_id: blank(a[1]) ? '' : String(a[1]).trim(),
    staff_id: blank(a[2]) ? '' : String(a[2]).trim(),
    name: a[3], start: toMin(a[4]), end: toMin(a[5]),
    updated_at: toNum(a[6], 'updated_at'),
    deleted: toBool(a[7])
  });
}

function validateWage(r) {
  if (!r || blank(r.id)) throw new Error('Missing id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) throw new Error('Bad date "' + r.date + '" (use YYYY-MM-DD)');
  if (typeof r.rate !== 'number' || !isFinite(r.rate) || r.rate < 0) throw new Error('Bad rate ' + r.rate);
  if (!Number.isFinite(r.updated_at)) throw new Error('Bad updated_at ' + r.updated_at);
  return { id: String(r.id), date: String(r.date), rate: r.rate, note: blank(r.note) ? null : String(r.note),
    updated_at: r.updated_at, deleted: !!r.deleted };
}

function wageToSheet(r) { return [r.id, r.date, r.rate, r.note || '', r.updated_at, !!r.deleted]; }

function sheetToWage(a) {
  return validateWage({
    id: blank(a[0]) ? '' : String(a[0]).trim(),
    date: String(a[1]).trim(),
    rate: toNum(a[2], 'rate'),
    note: blank(a[3]) ? null : String(a[3]),
    updated_at: toNum(a[4], 'updated_at'),
    deleted: toBool(a[5])
  });
}

function validateStaff(r) {
  if (!r || blank(r.id)) throw new Error('Missing id');
  if (blank(r.name)) throw new Error('Missing name');
  var roles = r.roles === undefined || r.roles === null ? [] : r.roles;
  if (!Array.isArray(roles)) throw new Error('Bad roles');
  var aliases = r.aliases === undefined || r.aliases === null ? [] : r.aliases;
  if (!Array.isArray(aliases)) throw new Error('Bad aliases');
  var status = blank(r.status) ? 'active' : r.status;
  if (status !== 'active' && status !== 'inactive') throw new Error('Bad status "' + status + '" (active or inactive)');
  if (!Number.isFinite(r.updated_at)) throw new Error('Bad updated_at ' + r.updated_at);
  var text = function (v) { return blank(v) ? null : String(v).trim(); };
  var photo = text(r.photo);
  if (photo !== null && !/^data:image\/(jpeg|png|webp);base64,/.test(photo)) throw new Error('Bad photo (a data:image URL)');
  if (photo !== null && photo.length > PHOTO_MAX) throw new Error('Photo is too large');
  var color = text(r.avatar_color);
  if (color !== null && !COLOR_RE.test(color)) throw new Error('Bad avatar_color "' + color + '" (#rrggbb or a palette name)');
  var initials = text(r.avatar_text);
  if (initials !== null && initials.length > 3) throw new Error('Avatar text is 3 characters at most');
  /* One entry per spelling, case-insensitive, never the name itself. A comma would split the Sheet cell, so it can't be in one. */
  var name = String(r.name).trim(), seen = {};
  seen[name.toLowerCase()] = true;
  var akas = [];
  aliases.forEach(function (x) {
    var a = String(x).replace(/,/g, ' ').replace(/\s+/g, ' ').trim(), k = a.toLowerCase();
    if (a === '' || seen[k]) return;
    seen[k] = true;
    akas.push(a);
  });
  /* The main role is never also one of the others. */
  var role = text(r.role), main = role === null ? '' : role.toLowerCase(), others = {};
  return {
    id: String(r.id), name: name, first: text(r.first), last: text(r.last),
    roles: roles.map(function (x) { return String(x).trim(); }).filter(function (x) {
      var k = x.toLowerCase();
      if (x === '' || k === main || others[k]) return false;
      others[k] = true;
      return true;
    }),
    id_number: text(r.id_number), manager: !!r.manager, is_user: !!r.is_user, status: status,
    notes: blank(r.notes) ? null : String(r.notes), updated_at: r.updated_at, deleted: !!r.deleted,
    aliases: akas, photo: photo, avatar_color: color, avatar_text: initials, role: role
  };
}

function validateRole(r) {
  if (!r || blank(r.id)) throw new Error('Missing id');
  if (blank(r.name)) throw new Error('Missing name');
  if (String(r.name).indexOf(',') >= 0) throw new Error('A role name can\'t hold a comma');
  var color = blank(r.color) ? null : String(r.color).trim();
  if (color !== null && !COLOR_RE.test(color)) throw new Error('Bad color "' + color + '" (#rrggbb or a palette name)');
  var icon = blank(r.icon) ? null : String(r.icon).trim();
  if (icon !== null && !/^[a-z][a-zA-Z0-9-]{0,31}$/.test(icon)) throw new Error('Bad icon "' + icon + '"');
  var sort = blank(r.sort) ? 0 : Number(r.sort);
  if (!Number.isFinite(sort)) throw new Error('Bad sort ' + r.sort);
  if (!Number.isFinite(r.updated_at)) throw new Error('Bad updated_at ' + r.updated_at);
  return { id: String(r.id), name: String(r.name).replace(/\s+/g, ' ').trim(), color: color, icon: icon, sort: sort, updated_at: r.updated_at, deleted: !!r.deleted };
}

function roleToSheet(r) { return [r.id, r.name, r.color || '', r.icon || '', r.sort, r.updated_at, !!r.deleted]; }

function sheetToRole(a) {
  return validateRole({
    id: blank(a[0]) ? '' : String(a[0]).trim(), name: blank(a[1]) ? '' : String(a[1]),
    color: a[2], icon: a[3], sort: a[4], updated_at: toNum(a[5], 'updated_at'), deleted: toBool(a[6])
  });
}

function staffToSheet(r) {
  return [r.id, r.name, r.first || '', r.last || '', (r.roles || []).join(', '), r.id_number || '',
    !!r.manager, !!r.is_user, r.status, r.notes || '', r.updated_at, !!r.deleted,
    (r.aliases || []).join(', '), r.photo || '', r.avatar_color || '', r.avatar_text || '', r.role || ''];
}

function sheetToStaff(a) {
  return validateStaff({
    id: blank(a[0]) ? '' : String(a[0]).trim(),
    name: blank(a[1]) ? '' : String(a[1]).trim(),
    first: a[2], last: a[3],
    roles: blank(a[4]) ? [] : String(a[4]).split(','),
    id_number: a[5], manager: toBool(a[6]), is_user: toBool(a[7]),
    status: blank(a[8]) ? 'active' : String(a[8]).trim().toLowerCase(),
    notes: blank(a[9]) ? null : String(a[9]),
    updated_at: toNum(a[10], 'updated_at'), deleted: toBool(a[11]),
    aliases: blank(a[12]) ? [] : String(a[12]).split(','),
    photo: a[13], avatar_color: a[14], avatar_text: a[15], role: a[16]
  });
}

function rowToSheet(r) {
  return [r.id, r.date, toHHMM(r.start), toHHMM(r.end),
    r.tips === null ? '' : r.tips, r.notes || '', r.updated_at, !!r.deleted,
    r.other === null || r.other === undefined ? '' : r.other,
    r.shift_type || '', !!r.party];
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
    shift_type: blank(a[9]) ? null : String(a[9]).trim().toLowerCase(),
    party: toBool(a[10])
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
 * - A table that comes back with nothing at all (no rows, none held) drops nothing. A tab that was renamed, deleted or
 *   cleared, or a new Sheet, reads as empty, and taking that as "every row was deleted" would wipe the device. Every
 *   local row is marked dirty instead, so the next sync writes it back.
 * local: {id: row with _dirty flag}; returns a new map. */
function reconcileClient(local, serverRows, heldIds) {
  if (!serverRows.length && !(heldIds || []).length) {
    var back = {};
    Object.keys(local).forEach(function (id) { back[id] = local[id]._dirty ? local[id] : Object.assign({}, local[id], { _dirty: true }); });
    return back;
  }
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
  module.exports = { PHOTO_MAX: PHOTO_MAX, ROLE_COLS: ROLE_COLS, validateRole: validateRole, roleToSheet: roleToSheet, sheetToRole: sheetToRole, WAGE_COLS: WAGE_COLS, validateWage: validateWage, wageToSheet: wageToSheet, sheetToWage: sheetToWage, wageRateFor: wageRateFor, wageFor: wageFor, CREW_COLS: CREW_COLS, validateCrew: validateCrew, crewToSheet: crewToSheet, sheetToCrew: sheetToCrew, crewHours: crewHours, STAFF_COLS: STAFF_COLS, validateStaff: validateStaff, staffToSheet: staffToSheet, sheetToStaff: sheetToStaff, COLS: COLS, INCOME_COLS: INCOME_COLS, CATEGORIES: CATEGORIES, sumIncome: sumIncome,
    validateIncome: validateIncome, incomeToSheet: incomeToSheet, sheetToIncome: sheetToIncome, toMin: toMin, toHHMM: toHHMM, hoursWorked: hoursWorked, defaultShiftType: defaultShiftType, tipsPerHour: tipsPerHour, totalIncome: totalIncome,
    validateRow: validateRow, rowToSheet: rowToSheet, sheetToRow: sheetToRow,
    pickNewer: pickNewer, mergeInto: mergeInto, reconcileClient: reconcileClient, stripLocal: stripLocal };
}
