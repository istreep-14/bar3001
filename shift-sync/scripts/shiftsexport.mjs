/* A "shifts-YYYY-MM-DD.json" export -> shift-sync bundle. Pure conversion (the CLI reads the file).
 *
 * The export is an array of { id, date, start, end (minutes), tips, notes, tags[], location, party,
 * partyName, shiftType: 'Day'|'Night'|null, segments?, ledger[], chump }.
 *
 * Mapping:
 *   id, date, start, end, tips   as they are (the original id is kept, so it can match a Sheet row)
 *   shiftType                    'Day' / 'Night'; when missing, the app's own rule (starts 3 PM or later = night)
 *   party                        the Party flag (also set when there is a party name)
 *   notes                        the original text first, then what has no field here:
 *                                "Party: <name>" (the details), "Location: X", "Tags: a, b"
 *   segments (tips by portion)   Day + Night: two shifts, split at the second portion's boundary, each with
 *                                its own tips. Same type twice: one shift, the split written into the notes.
 *   chump (number) / ledger      chump becomes a Chump income line; a non-empty ledger is copied into the notes
 *   wages                        passed through (the CLI reads brv2000's wage table)
 *   you                          alone on the crew with the shift's times (there is no staff list), when `me` is given
 */
import { clock } from './brv2000.mjs';

const kind = (t) => (String(t ?? '').toLowerCase() === 'day' ? 'day' : String(t ?? '').toLowerCase() === 'night' ? 'night' : null);
const derive = (start) => (start == null ? null : start >= 900 ? 'night' : 'day');   // core.defaultShiftType

/** @param {{ shifts: any[], me?: any, wages?: any[], skipIds?: string[] }} input */
export function convertExport({ shifts, me = null, wages = [], skipIds = [] }) {
  const out = { source: 'shifts-export', staff: [], rows: [], income: [], crew: [], wages, skipped: [], notes: [] };
  const person = me && {
    id: me.id, name: me.name, first: me.first ?? null, last: me.last ?? null, roles: me.roles ?? [], id_number: me.id_number ?? null,
    manager: !!me.manager, is_user: true, status: 'active', notes: null
  };
  if (person) out.staff.push(person);

  for (const s of [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)) {
    if (skipIds.includes(s.id)) { out.skipped.push(s.id); continue; }
    const segs = (s.segments ?? []).filter(g => g && g.tips != null);
    const types = new Set(segs.map(g => kind(g.type)));
    const split = segs.length === 2 && types.size === 2 && !types.has(null);

    const extra = [];
    const party = !!(s.party || s.partyName);
    if (s.partyName) extra.push(`Party: ${String(s.partyName).trim()}`);
    if (s.location) extra.push(`Location: ${s.location}`);
    if (s.tags?.length) extra.push(`Tags: ${s.tags.join(', ')}`);
    if (s.ledger?.length) extra.push(`Ledger: ${JSON.stringify(s.ledger)}`);
    if (segs.length === 2 && !split) extra.push(`Tips split: ${segs.map(g => `$${g.tips} from ${clock(g.boundary)}`).join(', ')}`);
    const base = [s.notes && String(s.notes).trim(), ...extra].filter(Boolean).map(x => x.replace(/[.\s]+$/, ''));   // no '..' where they join
    const notes = base.join('. ') || null;

    /** [id, shift_type, start, end, tips] */
    const parts = split
      ? [[s.id, kind(segs[0].type), s.start, segs[1].boundary, segs[0].tips], [`${s.id}-2`, kind(segs[1].type), segs[1].boundary, s.end, segs[1].tips]]
      : [[s.id, kind(s.shiftType) ?? derive(s.start), s.start, s.end, s.tips ?? null]];

    parts.forEach(([id, type, start, end, tips], i) => {
      out.rows.push({ id, date: s.date, start, end, tips, notes: i === 0 ? notes : `Second half of the ${s.date} shift`, other: null, shift_type: type, party: i === 0 && party });
      if (i === 0 && s.chump > 0) out.income.push({ id: `${id}-i1`, shift_id: id, category: 'Chump', amount: Number(s.chump), note: null });
      if (person) out.crew.push({ id: `${id}-${person.id}`, shift_id: id, staff_id: person.id, name: person.name, start, end });
    });
  }
  return out;
}
