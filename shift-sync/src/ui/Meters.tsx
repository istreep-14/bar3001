import type { ComponentChildren } from 'preact';

/* Inline meters: small enough to sit with a figure in a table row. Each is decoration for sighted readers (aria-hidden);
 * whoever uses one says the same thing in words (a tooltip and sr-only text). Styles: `.rankbar`, `.stackbar` and `.dial` in ui.css. */

/** A bar that fills 0-100% as far as `at` (0..1) says, in `color`, with a tick at `mark` (0..1) to measure against.
 *  `up` stands it on end, filling from the bottom. */
export function RankBar({ at, mark, color, up }: { at: number; mark?: number | null; color?: string; up?: boolean }) {
  return (
    <span class="rankbar" data-up={up ? '' : undefined} aria-hidden="true" style={{ '--at': at, ...(color ? { '--fill': color } : {}) }}>
      <i />
      {mark != null && <b style={{ '--mark': mark }} />}
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
