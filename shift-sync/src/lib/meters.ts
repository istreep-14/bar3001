/* The small inline meters that sit beside a figure in a table row: where a value stands among the others listed (a bar that
 * fills 0-100), and when a shift ran (a clock face with its hours filled in). Pure; the drawing is in ui/Meters.tsx. */

const HOUR = 60, DAY = 24 * HOUR;

/** How far up a set of values `v` sits, 0..1: the share of them below it, ties counted half (so the middle of a run of equal
 *  values reads as the middle). Null with fewer than two values, where standing means nothing. */
export function standing(values: (number | null)[], v: number): number | null {
  const all = values.filter((x): x is number => x != null);
  if (all.length < 2) return null;
  let below = 0, same = 0;
  for (const x of all) { if (x < v) below++; else if (x === v) same++; }
  return (below + same / 2) / all.length;
}

/** How far a standing leans from the middle, -1 (the bottom) through 0 (the middle) to 1 (the top): what a colour scale
 *  from red through plain to green is driven by. */
export function lean(at: number): number {
  return Math.max(-1, Math.min(1, (at - 0.5) * 2));
}

/** A shift's span in minutes from the midnight it started after; one that ends at or before its start runs past midnight. */
export function span(start: number, end: number): [number, number] {
  return [start, end > start ? end : end + DAY];
}

/** Where a shift sits on a 12-hour clock face, in degrees clockwise from 12: where it starts, and how far round it runs
 *  (a whole turn at most, so a shift of twelve hours or more fills the face). */
export function clockArc(start: number, end: number): { from: number; sweep: number } {
  const [a, b] = span(start, end);
  return { from: ((a % (12 * HOUR)) / (12 * HOUR)) * 360, sweep: Math.min(360, ((b - a) / (12 * HOUR)) * 360) };
}

/** A CSS colour on the scale from red (`lean` -1, the bottom) through `mid` (0) to green (1, the top), `strength`% of the
 *  way at either end: continuous, so every step up or down shows, not a few bins. */
export function scaleColor(l: number, mid: string, strength: number): string {
  return Math.abs(l) < 0.02 ? mid : `color-mix(in srgb, var(${l > 0 ? '--good' : '--bad'}) ${Math.round(Math.abs(l) * strength)}%, ${mid})`;
}
