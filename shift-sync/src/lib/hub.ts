import { hoursWorked } from '../core/core.generated.js';
import type { Crew } from '../core/core.generated.js';
import { addDays } from './dates.ts';
import type { ShiftView } from './stats.ts';

/* The Hub's weekly crew grid: one row per bartender, one column per day (Monday to Sunday), each cell that person's hours on
 * that day's shift(s). Derived from the shifts; editing a cell writes a crew line (data/store.ts saveCrewLine). */
export interface Person { id: string; name: string; is_user?: boolean }
export interface Cell { date: string; shifts: { view: ShiftView; line: Crew | null }[]; hours: number }
export interface GridRow { staff_id: string; name: string; cells: Cell[]; hours: number }
export interface Grid { days: string[]; rows: GridRow[]; dayHours: number[]; total: number; shiftsPerDay: ShiftView[][] }

export function crewWeek(views: ShiftView[], monday: string, people: Person[], extra: string[] = []): Grid {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const week = views.filter(v => v.shift.date >= days[0]! && v.shift.date <= days[6]!);
  const shiftsPerDay = days.map(d => week.filter(v => v.shift.date === d));
  const ids = new Set<string>(extra);
  for (const v of week) for (const c of v.crew) ids.add(c.staff_id);
  const byId = new Map(people.map(p => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? week.flatMap(v => v.crew).find(c => c.staff_id === id)?.name ?? 'Unknown';
  const rows: GridRow[] = [...ids].map(id => {
    const cells = days.map((date, i): Cell => {
      const shifts = shiftsPerDay[i]!.map(view => ({ view, line: view.crew.find(c => c.staff_id === id) ?? null }));
      return { date, shifts, hours: shifts.reduce((a, s) => a + (s.line ? hoursWorked(s.line.start, s.line.end) ?? 0 : 0), 0) };
    });
    return { staff_id: id, name: name(id), cells, hours: cells.reduce((a, c) => a + c.hours, 0) };
  }).sort((a, b) => Number(!!byId.get(b.staff_id)?.is_user) - Number(!!byId.get(a.staff_id)?.is_user) || a.name.localeCompare(b.name));
  const dayHours = days.map((_, i) => rows.reduce((a, r) => a + r.cells[i]!.hours, 0));
  return { days, rows, dayHours, total: dayHours.reduce((a, b) => a + b, 0), shiftsPerDay };
}
