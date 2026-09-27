import { validateCrew, validateIncome, validateRow, validateStaff, validateWage } from '../core/core.generated.js';
import type { Crew, Income, Shift, Staff, Wage } from '../core/core.generated.js';

/** What scripts/migrate-brv2000.mjs writes: records without `updated_at` / `deleted`. */
export interface Bundle {
  source?: string;
  staff: Omit<Staff, 'updated_at' | 'deleted'>[];
  rows: Omit<Shift, 'updated_at' | 'deleted'>[];
  income: Omit<Income, 'updated_at' | 'deleted'>[];
  crew: Omit<Crew, 'updated_at' | 'deleted'>[];
  wages?: Omit<Wage, 'updated_at' | 'deleted'>[];
}
export interface Existing { shiftIds: Set<string>; incomeIds: Set<string>; crewIds: Set<string>; staffIds: Set<string>; wageIds?: Set<string>; wageDates?: Set<string>; staff: Pick<Staff, 'id' | 'name' | 'is_user'>[] }
export interface Plan { staff: Staff[]; rows: Shift[]; income: Income[]; crew: Crew[]; wages: Wage[]; skipped: number; problems: string[] }

/** Decides what an import adds. Never overwrites: anything already here (even deleted) is left alone,
 * so re-running an import is harmless and your later edits are safe. People are matched by name. */
export function planImport(b: Bundle, have: Existing, now: number): Plan {
  const plan: Plan = { staff: [], rows: [], income: [], crew: [], wages: [], skipped: 0, problems: [] };
  const attempt = <T,>(what: string, fn: () => T): T | null => {
    try { return fn(); } catch (e) { plan.problems.push(`${what}: ${e instanceof Error ? e.message : e}`); return null; }
  };
  const stamp = { updated_at: now, deleted: false };

  // A wage is left alone if its id is here or another wage already starts that day (which would apply?).
  const wageDates = new Set(have.wageDates ?? []);
  for (const w of b.wages ?? []) {
    if (have.wageIds?.has(w.id) || wageDates.has(w.date)) { plan.skipped++; continue; }
    const rec = attempt(`wage ${w.date}`, () => validateWage({ ...w, ...stamp }));
    if (rec) { plan.wages.push(rec); wageDates.add(rec.date); }
  }

  const byName = new Map(have.staff.map(p => [p.name.toLowerCase(), p.id]));
  const idMap = new Map<string, string>();     // bundle person id -> id on this device
  let haveMe = have.staff.some(p => p.is_user);
  for (const p of b.staff) {
    const same = byName.get(p.name.toLowerCase());
    if (same || have.staffIds.has(p.id)) { idMap.set(p.id, same ?? p.id); plan.skipped++; continue; }
    const rec = attempt(`person ${p.name}`, () => validateStaff({ ...p, is_user: p.is_user && !haveMe, ...stamp }));
    if (!rec) continue;
    if (rec.is_user) haveMe = true;
    plan.staff.push(rec); idMap.set(p.id, rec.id); byName.set(rec.name.toLowerCase(), rec.id);
  }

  const added = new Set<string>();
  for (const r of b.rows) {
    if (have.shiftIds.has(r.id)) { plan.skipped++; continue; }
    const rec = attempt(`shift ${r.date}`, () => validateRow({ ...r, ...stamp }));
    if (rec) { plan.rows.push(rec); added.add(rec.id); }
  }
  for (const i of b.income) {
    if (!added.has(i.shift_id) || have.incomeIds.has(i.id)) continue;
    const rec = attempt(`income ${i.id}`, () => validateIncome({ ...i, ...stamp }));
    if (rec) plan.income.push(rec);
  }
  for (const c of b.crew) {
    if (!added.has(c.shift_id) || have.crewIds.has(c.id)) continue;
    const staff_id = idMap.get(c.staff_id);
    if (!staff_id) { plan.problems.push(`crew ${c.id}: ${c.name ?? c.staff_id} is not on the roster`); continue; }
    const rec = attempt(`crew ${c.id}`, () => validateCrew({ ...c, staff_id, ...stamp }));
    if (rec) plan.crew.push(rec);
  }
  return plan;
}
