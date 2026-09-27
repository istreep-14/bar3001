import type { Bundle } from '../src/lib/bundle.ts';
export interface Converted extends Bundle { skipped: string[]; notes: string[] }
export function wageOf(w: { effectiveDate: string; rate: number }): { id: string; date: string; rate: number; note: null };
export function clock(min: number): string;
export function convert(input: { config: unknown; shifts: unknown[]; skipDates?: string[] }): Converted;
