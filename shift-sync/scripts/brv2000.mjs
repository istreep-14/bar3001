/* brv2000 -> shift-sync. Pure conversion, no I/O (the CLI in migrate-brv2000.mjs reads the files).
 *
 * brv2000 keeps one JSON file per date: { date, segments: [{ type, start, end, breaks, wage, tips,
 * location, otherIncome, staff, party }] } with times in minutes (end may run past 1440 = after
 * midnight) and a roster in config.workers.
 *
 * Mapping (ids are deterministic, so importing twice never duplicates):
 *   workers            -> Staff   (positions -> roles, ID -> id_number)
 *   segment            -> Shift   (end % 1440; tips as is)
 *   segment.staff[]    -> Crew    (each with their own start/end)
 *   segment.otherIncome-> Income  (chump -> Chump; allotment and employer have no category here,
 *                                  so they become Cash with the original name in the note)
 *   config.wageRateTable -> Wage (an hourly wage from each effective date)
 *   no staff list      -> you alone on the crew, with the shift's own times
 * What has no field here (breaks, wage overrides, location, stations, party) goes into the shift's
 * notes as plain text, so nothing is dropped.
 */
const CATEGORY = { chump: 'Chump', allotment: 'Cash', employer: 'Cash' };
const NOTE = { allotment: 'Pool allotment', employer: 'Employer cash' };

export const clock = (min) => {
  const m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${h % 12 || 12}:${mm}${h < 12 ? 'a' : 'p'}`;
};
const span = (a, b) => `${clock(a)}–${clock(b)}`;
const wrap = (min) => (min == null ? null : ((min % 1440) + 1440) % 1440);

/** brv2000's { effectiveDate, rate } as a Wage (same id as the other importers, so a repeat is skipped). */
export const wageOf = (w) => ({ id: `b2k-wage-${w.effectiveDate}`, date: w.effectiveDate, rate: w.rate, note: null });

/** @param {{ config: any, shifts: any[], skipDates?: string[] }} input */
export function convert({ config, shifts, skipDates = [] }) {
  const out = { source: 'brv2000', staff: [], rows: [], income: [], crew: [], wages: [], skipped: [], notes: [] };
  for (const w of config?.wageRateTable ?? []) out.wages.push(wageOf(w));
  const byName = new Map();
  const workers = config?.workers ?? [];
  for (const w of workers) {
    const p = {
      id: `b2k-w${w.worker_id}`, name: w.name, first: w.first_name ?? null, last: w.last_name ?? null,
      roles: w.positions ?? [], id_number: w.ID ?? null, manager: !!w.manager, is_user: !!w.is_user, status: 'active', notes: null
    };
    out.staff.push(p); byName.set(String(w.name).toLowerCase(), p);
  }
  const me = out.staff.find(p => p.is_user);
  const person = (name) => {
    let p = byName.get(String(name).toLowerCase());
    if (!p) {   // worked a shift but is not on the roster: add them rather than lose the row
      p = { id: `b2k-n-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, first: null, last: null, roles: [], id_number: null, manager: false, is_user: false, status: 'active', notes: null };
      out.staff.push(p); byName.set(p.name.toLowerCase(), p);
      out.notes.push(`"${name}" worked a shift but is not in config.workers; added to the roster.`);
    }
    return p;
  };

  for (const sh of [...shifts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (skipDates.includes(sh.date)) { out.skipped.push(sh.date); continue; }
    (sh.segments ?? []).forEach((seg, si) => {
      const id = `b2k-${sh.date}` + (si ? `-${si + 1}` : '');
      const notes = [];
      if (seg.location) notes.push(`Location: ${seg.location}`);
      const brk = (bs) => (bs ?? []).map(b => span(b.start, b.end));
      if (brk(seg.breaks).length) notes.push(`Break ${brk(seg.breaks).join(', ')}`);
      const w = seg.wage ?? {};
      if (w.startOverride != null || w.endOverride != null) notes.push(`Paid ${w.startOverride != null ? clock(w.startOverride) : '?'}–${w.endOverride != null ? clock(w.endOverride) : '?'}`);
      if (w.rateOverride != null) notes.push(`Wage rate $${w.rateOverride}`);
      if (seg.party) {
        const p = seg.party;
        notes.push(['Party', p.type, p.name && `"${p.name}"`, p.size != null && `${p.size} guests`, p.start != null && `from ${clock(p.start)}`, p.location && `(${p.location})`].filter(Boolean).join(' '));
      }
      const staff = seg.staff ?? [];
      if (staff.length > 0) {
        // Only where someone stood somewhere other than the usual spot (the segment's, else the commonest).
        const counts = {}; for (const s of staff) if (s.location) counts[s.location] = (counts[s.location] ?? 0) + 1;
        const usual = seg.location ?? Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
        const stations = staff.filter(s => s.location && s.location !== usual).map(s => `${s.name} ${s.location}`);
        if (stations.length) notes.push(`Stations: ${stations.join(', ')}`);
        const breaks = staff.filter(s => brk(s.breaks).length && s.name !== me?.name).map(s => `${s.name} ${brk(s.breaks).join(', ')}`);
        if (breaks.length) notes.push(`Crew breaks: ${breaks.join('; ')}`);
      }
      out.rows.push({
        id, date: sh.date, start: wrap(seg.start), end: wrap(seg.end), tips: seg.tips ?? null,
        notes: notes.join('. ') || null, other: null, shift_type: seg.type === 'day' || seg.type === 'night' ? seg.type : null,
        party: !!seg.party
      });
      (seg.otherIncome ?? []).forEach((o, i) => {
        const cat = CATEGORY[o.category];
        if (!cat) { out.notes.push(`${sh.date}: unknown income category "${o.category}" skipped.`); return; }
        const bits = [NOTE[o.category], o.coinValue != null && `coins $${o.coinValue}`, o.note].filter(Boolean);
        out.income.push({ id: `${id}-i${i + 1}`, shift_id: id, category: cat, amount: o.amount, note: bits.join(', ') || null });
      });
      if (staff.length > 0) {
        for (const s of staff) {
          const p = person(s.name);
          out.crew.push({ id: `${id}-${p.id}`, shift_id: id, staff_id: p.id, name: p.name, start: wrap(s.start), end: wrap(s.end) });
        }
      } else if (me) {
        out.crew.push({ id: `${id}-${me.id}`, shift_id: id, staff_id: me.id, name: me.name, start: wrap(seg.start), end: wrap(seg.end) });
      }
    });
  }
  return out;
}
