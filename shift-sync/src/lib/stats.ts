import { crewHours, hoursWorked, sumIncome, tipsPerHour, totalIncome, wageFor, wageRateFor } from '../core/core.generated.js';
import type { Crew, Income, Local, Shift, Wage } from '../core/core.generated.js';
import { addDays, weekStart } from './dates.ts';
import { isPending } from './groups.ts';

/** A shift joined with its live income lines and every derived number. Never stored. */
export interface ShiftView {
  shift: Local<Shift>;
  income: Income[];
  /** Everyone who worked it, you included. */
  crew: Crew[];
  hours: number | null;
  tph: number | null;
  extra: number;          // income lines + legacy `other`
  /** Estimated: hours times the hourly wage in effect that day. Null without hours or a rate. */
  wage: number | null;
  wageRate: number | null;
  total: number;          // tips + other income + estimated wage
  /** Everything earned that shift over its hours. Null without hours. (Rate, the ranking metric, stays tips only.) */
  perHour: number | null;
  crewCount: number;      // bartenders on the shift
  crewHours: number;      // their hours added up (each from their own start/end)
}

export const toView = (shift: Local<Shift>, income: Income[], crew: Crew[] = [], rates: Pick<Wage, 'date' | 'rate'>[] = []): ShiftView => {
  const hours = hoursWorked(shift.start, shift.end);
  const wage = wageFor(rates, shift.date, hours);
  return {
    shift, income, crew, hours,
    tph: tipsPerHour(shift),
    extra: sumIncome(income) + (shift.other || 0),
    wage, wageRate: wageRateFor(rates, shift.date),
    total: totalIncome(shift, income, wage),
    perHour: hours ? totalIncome(shift, income, wage) / hours : null,
    crewCount: crew.length,
    crewHours: crewHours(crew)
  };
};

/** Newest first; within a day, latest start first. */
export const byRecent = (a: ShiftView, b: ShiftView): number =>
  b.shift.date.localeCompare(a.shift.date) || (b.shift.start ?? 0) - (a.shift.start ?? 0);

export interface Summary {
  shifts: number;
  hours: number;
  /** Everyone's hours added up, across the crews. */
  crewHours: number;
  tips: number;
  extra: number;
  wage: number;
  total: number;
  /** Tips over hours, counting only shifts that have both. Null when none do. */
  tph: number | null;
  /** Total earned over hours, counting only shifts that have hours. */
  perHour: number | null;
  perShift: number | null;
}

/** Only shifts with their money in count toward totals — a shift still scheduled or waiting on tips would skew
 *  hours and rates before its numbers are actually known. */
export function summarize(views: ShiftView[]): Summary {
  const done = views.filter(v => !isPending(v));
  let hours = 0, crewH = 0, tips = 0, extra = 0, wage = 0, tphHours = 0, tphTips = 0, phHours = 0, phTotal = 0;
  for (const v of done) {
    hours += v.hours ?? 0; crewH += v.crewHours; tips += v.shift.tips ?? 0; extra += v.extra; wage += v.wage ?? 0;
    if (v.tph != null && v.hours) { tphHours += v.hours; tphTips += v.shift.tips ?? 0; }
    if (v.hours) { phHours += v.hours; phTotal += v.total; }
  }
  const total = tips + extra + wage;
  return {
    shifts: done.length, hours, crewHours: crewH, tips, extra, wage, total,
    tph: tphHours ? tphTips / tphHours : null,
    perHour: phHours ? phTotal / phHours : null,
    perShift: done.length ? total / done.length : null
  };
}

/** good / bad relative to the scope's own average; within 20% is neutral. */
export const rateTone = (tph: number | null, avg: number | null): 'good' | 'bad' | null =>
  tph == null || avg == null || avg === 0 ? null : tph >= avg * 1.2 ? 'good' : tph <= avg * 0.8 ? 'bad' : null;

export interface Week { start: string; views: ShiftView[]; summary: Summary }
/** Groups newest-first views into calendar weeks (Monday to Sunday, `WEEK_START`). */
export function groupByWeek(views: ShiftView[]): Week[] {
  const out: Week[] = [];
  for (const v of views) {
    const start = weekStart(v.shift.date);
    const last = out[out.length - 1];
    if (last && last.start === start) last.views.push(v);
    else out.push({ start, views: [v], summary: null as unknown as Summary });
  }
  for (const w of out) w.summary = summarize(w.views);
  return out;
}

export const weekEnd = (start: string): string => addDays(start, 6);
