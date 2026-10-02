import type { ComponentChildren } from 'preact';
import { hours, moneyWhole, perHour } from '../lib/format.ts';
import type { Summary } from '../lib/stats.ts';
import type { IconName } from './Icon.tsx';
import type { KpiItem } from './kpi.tsx';
import { StatList } from './kpi.tsx';
import { isDesktop } from './viewport.ts';

interface Item { label: string; value: ComponentChildren; hint?: string }

/** The figures a set of shifts comes to, in the order every side column uses. */
export const periodItems = (s: Summary): Item[] => [
  { label: 'Shifts', value: s.shifts },
  { label: 'Hours', value: hours(s.hours) },
  { label: 'Tips', value: moneyWhole(s.tips) },
  { label: 'Rate', value: perHour(s.tph), hint: 'Tips over hours worked' },
  { label: 'Total', value: moneyWhole(s.total), hint: 'Tips, estimated wage and other income' }
];

const PERIOD_ICONS: Record<string, IconName> = { Shifts: 'log', Hours: 'clock', Tips: 'dollar', Rate: 'trend', Total: 'chart' };

/** The same period figures as chips, for list-page strips. */
export const periodChips = (s: Summary, keys?: string[]): KpiItem[] =>
  periodItems(s).filter(it => !keys || keys.includes(it.label)).map(it => ({ ...it, icon: PERIOD_ICONS[it.label] ?? 'chart', neutral: it.label === 'Hours' }));

/** A page's side column: optional content (an open shift, say), then a label, its figures, and a line of explanation.
 *  `phone`: only on a phone, stacked over the page; a desktop gives the table the width instead. */
export function SideStats({ label = 'This period', items, note, children, after, ariaLabel, phone }: {
  label?: string; items?: Item[]; note?: ComponentChildren; children?: ComponentChildren;
  /** Under the figures: a block that belongs with them, like the mini calendar. */
  after?: ComponentChildren; ariaLabel?: string; phone?: boolean;
}) {
  if (phone && isDesktop.value) return null;
  return (
    <aside class="panel-body side" aria-label={ariaLabel ?? label}>
      {children}
      {items && (
        <div class="side-block">
          <h3 class="label">{label}</h3>
          <StatList items={items} />
          {note && <p class="muted side-note">{note}</p>}
        </div>
      )}
      {after}
    </aside>
  );
}
