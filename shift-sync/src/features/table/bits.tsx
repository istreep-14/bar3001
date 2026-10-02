import type { ComponentChildren } from 'preact';
import { DASH, clockParts, clockShort, dec1, dollars } from '../../lib/format.ts';
import { bandLabel, groupCount, incomeParts, shiftStatus } from '../../lib/groups.ts';
import type { GroupBy, ShiftGroup } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { ShiftStatusPill } from '../../ui/Badges.tsx';
import type { TotalPart } from '../../ui/TotalFigure.tsx';

/** A weight for Table's fill mode: one unit is 5rem, so a 8.75rem column is 1.75. */
export const wt = (rem: number) => Math.round((rem / 5) * 100) / 100;

export const shiftKey = (v: ShiftView) => v.shift.date + String(v.shift.start ?? 0).padStart(4, '0');

/** End minute for sorting, so a close after midnight lands after the start instead of before it. */
export const endMin = (start: number | null, end: number | null) =>
  start == null || end == null ? null : end < start ? end + 1440 : end;

/** A start or end in the short table form ('5:00p', '2:15a'), the same figure the Crew sheet uses. */
export const clockCell = (m: number | null) =>
  m == null ? <span class="nil">{DASH}</span> : <span class="fig">{clockShort(m % 1440)}</span>;

/** The smaller clock: hour in one tone, AM/PM smaller and quieter. */
export const clockMark = (m: number | null) => {
  if (m == null) return <span class="nil">{DASH}</span>;
  const p = clockParts(m % 1440);
  return <span class="clk clk-soft">{p.hm}<small>{p.ap}</small></span>;
};

export const hoursFig = (n: number | null | undefined, semi = false) =>
  n == null ? <span class="nil">{DASH}</span> : <span class={`fig${semi ? ' fig-semi' : ''}`}>{dec1(n)}<span class="fig-unit">h</span></span>;

export const moneyKey = (n: number | null | undefined) => <span class="fig fig-key">{dollars(n)}</span>;
export const moneyMed = (n: number | null | undefined, semi = false) => <span class={`fig ${semi ? 'fig-semi' : 'fig-q'}`}>{dollars(n)}</span>;

export function BandLabel({ name, meta, title }: { name: string; meta: string; title?: string }) {
  return (
    <span class="l2" title={title}>
      <span class="band-name">{name}</span>
      <span class="band-meta">{meta}</span>
    </span>
  );
}

export function bandOf(key: string, by: GroupBy, g: ShiftGroup) {
  const { name, title } = bandLabel(key, by);
  return <BandLabel name={name} meta={groupCount(g)} title={title} />;
}

export function FootCount({ counted, pending }: { counted: number; pending: number }) {
  const tip = 'Awaiting tips and upcoming shifts never count toward totals';
  return (
    <span class="l2">
      <span class="foot-label">{counted} counted</span>
      {pending > 0 && (
        <span class="foot-sub tip" data-tip={tip}>{pending} not counted<span class="sr-only">. {tip}</span></span>
      )}
    </span>
  );
}

/** Pending rows put the status pill in the first money cell; it spills across the blank ones after it. */
export function moneyOrStatus(v: ShiftView, node: ComponentChildren) {
  const st = shiftStatus(v);
  return st === 'done' ? node : <ShiftStatusPill status={st} />;
}

/** Tips, wage and other, summed across done shifts, in the order a stack bar draws them. */
export function summedParts(views: ShiftView[]): TotalPart[] {
  const acc = new Map<string, TotalPart>();
  for (const v of views) {
    if (shiftStatus(v) !== 'done') continue;
    for (const p of incomeParts(v)) {
      const cur = acc.get(p.key);
      if (cur) cur.amount += p.amount;
      else acc.set(p.key, { key: p.key, label: p.label, amount: p.amount, color: `var(${p.token})`, estimated: p.estimated });
    }
  }
  return [...acc.values()];
}

export function rowParts(v: ShiftView): TotalPart[] {
  return incomeParts(v).map(p => ({ key: p.key, label: p.label, amount: p.amount, color: `var(${p.token})`, estimated: p.estimated }));
}
