/* A shared time ruler for a set of spans (a week of crew times): every bar on it uses the same origin and length, so
 * bars in different rows line up by time of day. Starts at noon unless something starts earlier; an end before its
 * start runs past midnight (an end equal to it is no time, as core's hoursWorked counts it). Minutes since midnight in, percentages out. Pure. */
export interface Ruler { origin: number; length: number; ticks: number[] }
export interface Span { start: number | null; end: number | null }

const endOf = (s: number, e: number) => (e < s ? e + 1440 : e);

export function rulerFor(spans: Span[], minLength = 12 * 60): Ruler {
  const timed = spans.filter((x): x is { start: number; end: number } => x.start != null && x.end != null);
  const origin = Math.min(12 * 60, ...timed.map(x => Math.floor(x.start / 60) * 60));
  const last = Math.max(origin + minLength, ...timed.map(x => Math.ceil(endOf(x.start, x.end) / 60) * 60));
  const length = last - origin;
  const step = length <= 12 * 60 ? 120 : 180;
  const ticks: number[] = [];
  for (let m = origin; m <= last; m += step) ticks.push(m);
  return { origin, length, ticks };
}

/** Where a span sits on the ruler, in percent. Null without both times. */
export function place(start: number | null, end: number | null, r: Ruler): { left: number; width: number } | null {
  if (start == null || end == null) return null;
  const s = start < r.origin ? start + 1440 : start;
  const left = ((s - r.origin) / r.length) * 100;
  const width = ((endOf(start, end) - start) / r.length) * 100;
  return { left: Math.max(0, left), width: Math.min(100 - Math.max(0, left), width) };
}

/** '12 PM', '3 AM': tick labels, 12-hour. */
export const tickLabel = (m: number): string => { const h = Math.floor(m / 60) % 24; return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };
