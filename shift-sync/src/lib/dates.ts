// Dates are 'YYYY-MM-DD' strings everywhere. All math is done in UTC so a
// device timezone or DST change can never shift a shift to another day. The one local read is today().
const DAY = 86_400_000;
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The device's own date, not UTC's: "today" is the day you're living in. Built from its parts rather than a locale's format
 *  (en-CA's has changed under browsers before), so it is always 'YYYY-MM-DD'. */
export const today = (): string => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
export const addDays = (d: string, n: number): string => iso(ms(d) + n * DAY);
export const daysBetween = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / DAY);
/** 0 = Sunday. */
export const weekday = (d: string): number => new Date(ms(d)).getUTCDay();
/** The one week the whole app uses: Monday to Sunday (the calendar grid, the Log's week groups, the Dashboard, Insights,
 *  Totals and Crew week all read it). Change it here and nowhere else. */
export const WEEK_START = 1;
export const weekStart = (d: string, firstDay = WEEK_START): string => addDays(d, -((weekday(d) - firstDay + 7) % 7));

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number): string => iso(Date.UTC(y, m, d));   // m is 0-based; overflow rolls over
export const parts = (d: string): { y: number; m: number; d: number } => ({ y: +d.slice(0, 4), m: +d.slice(5, 7) - 1, d: +d.slice(8, 10) });
export const monthKey = (d: string): string => d.slice(0, 7);
export { pad };
