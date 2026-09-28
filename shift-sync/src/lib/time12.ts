/* The form keeps times as 'HH:MM' (24-hour, what core's toMin parses). People pick them as hour, minute and AM/PM, so
 * the field never shows a 24-hour clock whatever the device's locale. These two convert between the forms. Pure. */
export interface Time12 { h: number; m: number; pm: boolean }   // h is 1–12

export function to12(hhmm: string): Time12 | null {
  const x = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!x) return null;
  const H = +x[1]!, m = +x[2]!;
  if (H > 23 || m > 59) return null;
  return { h: H % 12 || 12, m, pm: H >= 12 };
}

export function from12({ h, m, pm }: Time12): string {
  const H = (h % 12) + (pm ? 12 : 0);
  return `${String(H).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutes offered in the picker: every 5, plus the current value's own minute if it is off that grid. */
export const minuteOptions = (current: number | null): number[] => {
  const base = Array.from({ length: 12 }, (_, i) => i * 5);
  return current != null && !base.includes(current) ? [...base, current].sort((a, b) => a - b) : base;
};
