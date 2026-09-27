// Dates are 'YYYY-MM-DD' strings everywhere. All math is done in UTC so a
// device timezone or DST change can never shift a shift to another day.
const DAY = 86_400_000;
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const today = (): string => new Date().toLocaleDateString('en-CA');
export const addDays = (d: string, n: number): string => iso(ms(d) + n * DAY);
export const daysBetween = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / DAY);
/** 0 = Sunday. */
export const weekday = (d: string): number => new Date(ms(d)).getUTCDay();
export const weekStart = (d: string, firstDay = 0): string => addDays(d, -((weekday(d) - firstDay + 7) % 7));

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number): string => iso(Date.UTC(y, m, d));   // m is 0-based; overflow rolls over
export const parts = (d: string): { y: number; m: number; d: number } => ({ y: +d.slice(0, 4), m: +d.slice(5, 7) - 1, d: +d.slice(8, 10) });
export const monthKey = (d: string): string => d.slice(0, 7);
export { pad };
