import type { ComponentChildren } from 'preact';
import { clockTight } from '../lib/format.ts';
import { tickLabel } from '../lib/ruler.ts';
import type { Ruler } from '../lib/ruler.ts';

/* Inline meters: small enough to sit with a figure in a table row. Each is decoration for sighted readers (aria-hidden);
 * whoever uses one says the same thing in words (a tooltip and sr-only text). Styles: `.rankbar`, `.stackbar`, `.dial`, `.segm`, `.rl-*` and `.barstrip` in ui.css. */

/** A bar that fills 0-100% as far as `at` (0..1) says, in `color`, with a tick at `mark` (0..1) to measure against.
 *  `up` stands it on end, filling from the bottom (RateFigure's rank bar). Lying flat it is 3px tall, for shares (Of the
 *  shift, Share, a side panel's legend) and standings ($/hr on Pay): `width` sets its length (a CSS length, '4.5rem';
 *  the default fills its box) and `soft` draws its track in --line-soft instead of --surface-3. */
export function RankBar({ at, mark, color, up, width, soft }: { at: number; mark?: number | null; color?: string; up?: boolean; width?: string; soft?: boolean }) {
  return (
    <span class="rankbar" data-up={up ? '' : undefined} data-soft={soft ? '' : undefined} aria-hidden="true"
      style={{ '--at': Math.max(0, Math.min(1, at)), ...(color ? { '--fill': color } : {}), ...(width ? { width } : {}) }}>
      <i />
      {mark != null && <b style={{ '--mark': Math.max(0, Math.min(1, mark)) }} />}
    </span>
  );
}

/** A thin bar split into parts, each as wide as its share of the whole, in its own colour (a CSS colour each). */
export function StackBar({ parts }: { parts: { key: string; amount: number; color: string }[] }) {
  const total = parts.reduce((t, p) => t + p.amount, 0);
  if (!total) return null;
  return (
    <span class="stackbar" aria-hidden="true">
      {parts.filter(p => p.amount > 0).map(p => <i key={p.key} style={{ flexGrow: p.amount / total, background: p.color }} />)}
    </span>
  );
}

const C = 10, R = 9;
const at = (deg: number) => { const t = (deg * Math.PI) / 180; return `${(C + R * Math.sin(t)).toFixed(2)} ${(C - R * Math.cos(t)).toFixed(2)}`; };

/** A value in a ring drawn only by what it marks: an arc round an unseen 12-hour clock, `from` degrees clockwise from 12 and
 *  `sweep` degrees round (360 closes it), in `color`. The value (`children`) sits in the middle. */
export function ClockDial({ from, sweep, color, children }: { from: number; sweep: number; color?: string; children?: ComponentChildren }) {
  return (
    <span class="dial" style={color ? { '--fill': color } : undefined}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {sweep >= 360
          ? <circle class="dial-arc" cx={C} cy={C} r={R} />
          : sweep > 0 && <path class="dial-arc" d={`M${at(from)}A${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${at(from + sweep)}`} />}
      </svg>
      {children != null && <span class="dial-value">{children}</span>}
    </span>
  );
}

/** One capsule of a SegMeter: filled in `color`, or an outline (`--line`); `dashed` for a pending day, `ring` (a CSS
 *  colour) for a party. */
export interface SegCell { color?: string; dashed?: boolean; ring?: string }

/** 'n of N' as a row of capsules: the first `n` of `of` filled in `color` (--accent by default), the rest in --line.
 *  Small (0.5 x 0.3125rem, 2px apart) under a figure; `tall` (0.55 x 0.875rem, 3px apart) for a week's days. Pass
 *  `cells` instead to colour each capsule (Weeks' Mon-Sun: night, day, pending, party). */
export function SegMeter({ n = 0, of = 0, color, tall, cells }: { n?: number; of?: number; color?: string; tall?: boolean; cells?: SegCell[] }) {
  const list: SegCell[] = cells ?? Array.from({ length: of }, (_, i) => (i < n ? { color: color ?? 'var(--accent)' } : {}));
  return (
    <span class="segm" data-tall={tall ? '' : undefined} aria-hidden="true">
      {list.map((c, i) => <i key={i} data-on={c.color ? '' : undefined} data-dashed={c.dashed ? '' : undefined} data-ring={c.ring ? '' : undefined}
        style={{ ...(c.color ? { '--fill': c.color } : {}), ...(c.ring ? { '--ring': c.ring } : {}) }} />)}
    </span>
  );
}

/* ── rulers: every bar in a column on one shared clock (lib/ruler.ts rulerFor), so bars in different rows line up ── */

/** Where a minute (since the midnight the ruler starts after) sits on the ruler, in percent. Ticks are in these minutes. */
export const rulerAt = (r: Ruler, m: number): number => ((m - r.origin) / r.length) * 100;

/** A ruler cell's track: the gridlines (one per tick, --line-soft; midnight dashed in --ink-4) and whatever bars it holds
 *  (RangeBar). Fills the cell's height. `children` are positioned in percent of the track. aria-hidden: the caller
 *  wraps it in a tip with the same words. */
export function RulerTrack({ ruler, children, grid = true }: { ruler: Ruler; children?: ComponentChildren; grid?: boolean }) {
  return (
    <span class="rl" aria-hidden="true">
      <span class="rl-in">
        {grid && ruler.ticks.map(m => <span key={m} class="rl-grid" data-mid={m % 1440 === 0 ? '' : undefined} style={{ left: `${rulerAt(ruler, m)}%` }} />)}
        {children}
      </span>
    </span>
  );
}

/** The ruler's tick labels for a column head (`Column.headCell`) or the foot: '6 PM 9 PM 12 AM', or '6p 9p 12a' when
 *  `compact`. `every` keeps one label in that many. Set inside the same inset as RulerTrack, so labels sit over their lines. */
export function RulerHead({ ruler, compact, every = 1 }: { ruler: Ruler; compact?: boolean; every?: number }) {
  const n = ruler.ticks.length;
  return (
    <span class="rl-head" aria-hidden="true">
      <span class="rl-in">
        {ruler.ticks.map((m, i) => (i % every ? null : (
          <span key={m} class="rl-tick" data-edge={i === 0 ? 'l' : i === n - 1 ? 'r' : undefined} style={{ left: `${rulerAt(ruler, m)}%` }}>
            {compact ? clockTight(m % 1440) : tickLabel(m)}
          </span>
        )))}
      </span>
    </span>
  );
}

/** What a span on the ruler is drawn as.
 *   bar      a 0.5rem capsule, solid in `color` (a done shift)
 *   outline  the same capsule as a 1.5px outline (worked, awaiting tips)
 *   open     a dashed outline that fades out to the right (scheduled; an open crew line)
 *   ghost    a 1px --line-strong outline (a band's average span)
 *   track    a 2px --line-strong line under the bar (the whole crew's night)
 *   whisker  a 2px --line-strong line through the middle (earliest start to latest end)
 *   band     a 0.875rem --accent-wash band (your own span, behind crew lines)
 *   line     a 0.375rem capsule in `color` (a crew line); `dim` for the part outside your band */
export type RangeKind = 'bar' | 'outline' | 'open' | 'ghost' | 'track' | 'whisker' | 'band' | 'line';

/** One span on a RulerTrack, from `place` / `placeSpan` (lib/ruler.ts): `left` and `width` in percent. */
export function RangeBar({ left, width, kind = 'bar', color, dim }: { left: number; width: number; kind?: RangeKind; color?: string; dim?: boolean }) {
  return <span class="rl-bar" data-kind={kind} data-dim={dim ? '' : undefined} style={{ left: `${left}%`, width: `${Math.max(0, width)}%`, ...(color ? { '--kc': color } : {}) }} />;
}

/** One bar per item, 3px wide and 2px apart, up to 1.75rem tall: `h` is its height as a share (0..1) of the tallest,
 *  `color` its fill. A `mark` (a letter) puts a dot over that bar with the letter above it: the best night of a week. */
export function BarStrip({ bars }: { bars: { h: number; color: string; mark?: string }[] }) {
  return (
    <span class="barstrip" aria-hidden="true">
      {bars.map((b, i) => <span key={i} data-mark={b.mark} style={{ height: `max(3px, ${Math.max(0, Math.min(1, b.h)) * 100}%)`, '--fill': b.color }} />)}
    </span>
  );
}
