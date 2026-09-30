import type { ComponentChildren } from 'preact';
import { hours, moneyWhole, perHour } from '../lib/format.ts';
import type { Summary } from '../lib/stats.ts';
import { StatList } from './kpi.tsx';

interface Item { label: string; value: ComponentChildren; hint?: string }

/** The figures a set of shifts comes to, in the order every side column uses. */
export const periodItems = (s: Summary): Item[] => [
  { label: 'Shifts', value: s.shifts },
  { label: 'Hours', value: hours(s.hours) },
  { label: 'Tips', value: moneyWhole(s.tips) },
  { label: 'Rate', value: perHour(s.tph), hint: 'Tips over hours worked' },
  { label: 'Total', value: moneyWhole(s.total), hint: 'Tips, estimated wage and other income' }
];

/** A page's side column: optional content (an open shift, say), then a label, its figures, and a line of explanation. */
export function SideStats({ label = 'This period', items, note, children, ariaLabel }: {
  label?: string; items?: Item[]; note?: ComponentChildren; children?: ComponentChildren; ariaLabel?: string;
}) {
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
    </aside>
  );
}
