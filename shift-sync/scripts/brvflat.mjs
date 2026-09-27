/* brv-flat -> shift-sync. Pure conversion (the CLI reads the CSVs).
 *
 * brv-flat keeps one row per DATE: { date, start, end (HH:MM), shift_type Day|Night|Double, switchover,
 * tips, day, night } where day / night are portion documents { tips, location, party, party_name, tags,
 * notes, income[], staff[] }, plus staff.csv (roles joined with "|").
 *
 * Mapping:
 *   staff.csv      -> Staff (roles split on "|"; kept as they are, sample rows included: shifts point at them)
 *   Day / Night    -> one Shift over start..end
 *   Double         -> with both portions: two Shifts, day = start..switchover, night = switchover..end
 *                     with one portion only: one Shift over the whole span
 *   income[]       -> Income (same category names)
 *   staff[]        -> Crew; a blank timeIn/timeOut means the shift's own time
 *   nobody listed  -> you alone, with the shift's times (same rule as the brv2000 import)
 *   unlinked_income.csv -> each line becomes a shift of its own with no times or tips (a shift has to
 *                     exist for income to hang off), noted as income with no shift
 * No field here: location, party, tags, a person's role and station. Location / party / tags go into
 * the shift's notes. Wage rates and settings are not imported.
 */
import { clock } from './brv2000.mjs';

/** RFC 4180-ish CSV; lines starting with # before the header are comments. Returns objects by header. */
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false, i = 0, lineStart = true;
  for (; i < text.length; i++) {
    const c = text[i];
    if (lineStart && !q && c === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    lineStart = false;
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; lineStart = true; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(x => x !== '')) rows.push(row); }
  const head = rows.shift() ?? [];
  return rows.map(r => Object.fromEntries(head.map((h, k) => [h, r[k] ?? ''])));
}

const min = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim()); return m ? +m[1] * 60 + +m[2] : null; };
const num = (v) => (v === '' || v == null ? null : Number(v));
const json = (v) => { if (!v || !String(v).trim()) return null; try { return JSON.parse(v); } catch { return null; } };
const bool = (v) => String(v).trim().toLowerCase() === 'true';
const filled = (d) => d && Object.keys(d).length > 0;

/** @param {{ shiftsCsv: string, staffCsv: string, unlinkedCsv?: string, skipDates?: string[] }} input */
export function convertFlat({ shiftsCsv, staffCsv, unlinkedCsv = '', skipDates = [] }) {
  const out = { source: 'brv-flat', staff: [], rows: [], income: [], crew: [], skipped: [], notes: [] };
  const byRef = new Map();
  for (const s of parseCsv(staffCsv)) {
    const p = {
      id: `bflat-${s.id}`, name: s.name, first: s.first || null, last: s.last || null,
      roles: s.roles ? s.roles.split('|').map(x => x.trim()).filter(Boolean) : [], id_number: s.id_number || null,
      manager: bool(s.manager), is_user: bool(s.is_user), status: s.status === 'inactive' ? 'inactive' : 'active', notes: s.notes || null
    };
    out.staff.push(p); byRef.set(s.id, p);
  }
  const me = out.staff.find(p => p.is_user);

  for (const r of parseCsv(shiftsCsv).sort((a, b) => a.date.localeCompare(b.date))) {
    if (skipDates.includes(r.date)) { out.skipped.push(r.date); continue; }
    const start = min(r.start), end = min(r.end), sw = min(r.switchover);
    const day = json(r.day), night = json(r.night);
    const dayOn = filled(day), nightOn = filled(night);
    const type = r.shift_type.toLowerCase();

    /** [portion doc, shift_type, start, end, id suffix] */
    let parts;
    if (type === 'double' && dayOn && nightOn && sw != null) parts = [[day, 'day', start, sw, '-day'], [night, 'night', sw, end, '-night']];
    else if (type === 'double') parts = [[nightOn ? night : day, nightOn ? 'night' : 'day', start, end, '']];
    else parts = [[type === 'day' ? day : night, type === 'day' ? 'day' : 'night', start, end, '']];
    if (type === 'double' && parts.length === 1 && !dayOn && !nightOn) parts = [[null, 'night', start, end, '']];

    for (const [doc, shiftType, s, e, suffix] of parts) {
      const id = `bflat-${r.date}${suffix}`;
      const d = doc ?? {};
      const notes = [d.notes && String(d.notes).trim(), d.location && `Location: ${d.location}`,
        d.party_name && `Party: ${d.party_name}`,
        d.tags?.length && `Tags: ${d.tags.join(', ')}`].filter(Boolean);
      // A day-only row keeps its rolled-up tips when the portion has none; a split shift uses each portion's own.
      const tips = d.tips != null ? d.tips : parts.length === 1 ? num(r.tips) : null;
      out.rows.push({ id, date: r.date, start: s, end: e, tips, notes: notes.join('. ') || null, other: null, shift_type: shiftType, party: !!(d.party || d.party_name) });
      (d.income ?? []).forEach((o, i) => out.income.push({ id: `${id}-i${i + 1}`, shift_id: id, category: o.category, amount: o.amount, note: o.note || null }));

      const crew = new Map();
      for (const a of d.staff ?? []) {
        const p = byRef.get(a.staffId);
        if (!p) { out.notes.push(`${r.date}: unknown staff ${a.staffId} skipped.`); continue; }
        crew.set(p.id, { p, start: min(a.timeIn) ?? s, end: min(a.timeOut) ?? e });
      }
      if (me && !crew.has(me.id)) crew.set(me.id, { p: me, start: s, end: e });   // you worked it
      for (const { p, start: cs, end: ce } of crew.values()) {
        out.crew.push({ id: `${id}-${p.id}`, shift_id: id, staff_id: p.id, name: p.name, start: cs, end: ce });
      }
    }
  }
  for (const u of parseCsv(unlinkedCsv)) {
    if (skipDates.includes(u.date)) { out.skipped.push(u.date); continue; }
    const id = `bflat-unlinked-${u.id}`;
    out.rows.push({ id, date: u.date, start: null, end: null, tips: null, notes: 'Income with no shift (brv-flat)', other: null, shift_type: null, party: false });
    out.income.push({ id: `${id}-i1`, shift_id: id, category: u.category, amount: Number(u.amount), note: u.note || null });
  }
  return out;
}
export { clock };
