/* A smooth line through points, drawn as cubic Béziers with monotone tangents (Fritsch–Carlson): the curve never bulges
 * past a point the way a plain spline does, so a running total never appears to dip and a peak stays where it was.
 * Pure geometry; the charts in parts/blocks draw the path it returns. */
export interface Pt { x: number; y: number }

/** An SVG path through `pts` (x increasing). One point is a dot-sized move; none is ''. */
export function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const f = (v: number) => +v.toFixed(2);
  if (n === 1) return `M${f(pts[0]!.x)},${f(pts[0]!.y)}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1]!.x - pts[i]!.x); m.push((pts[i + 1]!.y - pts[i]!.y) / (dx[i] || 1)); }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  t.push(m[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i]! / m[i]!, b = t[i + 1]! / m[i]!, s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]!; t[i + 1] = k * b * m[i]!; }
  }
  let d = `M${f(pts[0]!.x)},${f(pts[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i]!, q = pts[i + 1]!, h = dx[i]! / 3;
    d += ` C${f(p.x + h)},${f(p.y + t[i]! * h)} ${f(q.x - h)},${f(q.y - t[i + 1]! * h)} ${f(q.x)},${f(q.y)}`;
  }
  return d;
}

/** The same line closed down to `base` (the chart's floor), for a soft area fill under it. */
export const areaPath = (pts: Pt[], base: number): string =>
  pts.length < 2 ? '' : `${smoothPath(pts)} L${pts[pts.length - 1]!.x.toFixed(2)},${base} L${pts[0]!.x.toFixed(2)},${base} Z`;
