import type { ComponentChildren } from 'preact';

/* Small KPI parts, the vocabulary the Overview tiles, the Journal, the Calendar's month line and the Log's footer share:
 *   Spark      a few points of trend, no axes
 *   DeltaPill  the change against something, arrow + percent (never colour alone)
 *   Meter      one figure against its ceiling (rate vs your best, hours vs the 40-hour week)
 *   MiniStat   label, value, and optionally a delta and a spark, on one line
 * Decorative graphics are aria-hidden; the number next to them says the same thing in words. */

/** A sparkline over `values` (nulls skipped). Needs two points to draw anything. */
export function Spark({ values, w = 64, h = 22 }: { values: (number | null)[]; w?: number; h?: number }) {
  const pts = values.map((v, i) => (v == null ? null : { i, v })).filter((p): p is { i: number; v: number } => !!p);
  if (pts.length < 2 || pts.every(p => p.v === 0)) return null;   // nothing to draw
  const lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v)), span = hi - lo || 1, last = values.length - 1 || 1;
  const x = (i: number) => 2 + (i / last) * (w - 4), y = (v: number) => h - 3 - ((v - lo) / span) * (h - 6);
  const line = pts.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const tip = pts[pts.length - 1]!;
  return (
    <svg class="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polygon class="spark-area" points={`${x(pts[0]!.i).toFixed(1)},${h} ${line} ${x(tip.i).toFixed(1)},${h}`} />
      <polyline class="spark-line" points={line} />
      <circle class="spark-dot" cx={x(tip.i)} cy={y(tip.v)} r="2.2" />
    </svg>
  );
}

/** ▲ 12% / ▼ 5% as a small pill. `neutral` = no good or bad (hours). Null when there is nothing to compare. */
export function DeltaPill({ pct, neutral }: { pct: number | null; neutral?: boolean }) {
  if (pct == null) return null;
  const r = Math.round(pct), tone = neutral || r === 0 ? 'flat' : r > 0 ? 'up' : 'down';
  return <span class={'dpill ' + tone}>{r > 0 ? '▲' : r < 0 ? '▼' : '▬'} {Math.abs(r)}%</span>;
}

/** A thin bar: `value` out of `max`. */
export function Meter({ value, max, label }: { value: number | null; max: number; label: string }) {
  if (value == null || !(max > 0)) return <span class="meter empty" aria-hidden="true" />;
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return <span class="meter" role="img" aria-label={label} title={label}><i style={{ width: pct + '%' }} /></span>;
}

/** A shift's start-to-end span over a fixed 24-hour track, so its place in the day reads at a glance.
 *  An overnight shift wraps: the span past midnight draws as a second, separate fill from the left edge. */
/** A short vertical list of figures, for the card beside a table. */
export function StatList({ items }: { items: { label: string; value: ComponentChildren; hint?: string }[] }) {
  return (
    <dl class="stats">
      {items.map(it => (
        <div key={it.label}><dt title={it.hint}>{it.label}</dt><dd>{it.value}</dd></div>
      ))}
    </dl>
  );
}

/** label · value · delta · spark, on one line. */
export function MiniStat({ label, value, pct, neutral, spark, hint }: { label: string; value: ComponentChildren; pct?: number | null; neutral?: boolean; spark?: (number | null)[]; hint?: string }) {
  return (
    <span class="ministat" title={hint}>
      <span class="mk">{label}</span><b class="mv">{value}</b>
      {pct != null && <DeltaPill pct={pct} neutral={neutral} />}
      {spark && <Spark values={spark} w={44} h={16} />}
    </span>
  );
}
