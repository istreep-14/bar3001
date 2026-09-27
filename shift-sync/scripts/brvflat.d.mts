import type { Converted } from './brv2000.mjs';
export function parseCsv(text: string): Record<string, string>[];
export function convertFlat(input: { shiftsCsv: string; staffCsv: string; unlinkedCsv?: string; skipDates?: string[] }): Converted;
