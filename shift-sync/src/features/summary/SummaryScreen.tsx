import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { addDays } from '../../lib/dates.ts';
import { DASH, MONTH_NAMES, WEEKDAY_NAMES, dec1, dollars, hours, money, shortDate } from '../../lib/format.ts';
import { BYS, isTime, summaryRows } from '../../lib/summary.ts';
import type { By, SumRow } from '../../lib/summary.ts';
import { summarize } from '../../lib/stats.ts';
import { pctChange } from '../../lib/trends.ts';

import { DeltaPill } from '../../ui/kpi.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { oneOf, persisted } from '../../data/persisted.ts';
import { EmptyPeriod, FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import { SideStats, periodItems } from '../../ui/SideStats.tsx';
import styles from './SummaryScreen.module.css';

/* Summary: the Log's grouped-row totals as a table of their own. Fold the shifts in the period into weeks, months, years, weekdays,
 * types or party / no party, and see every column summed for each; time groups also show the change against the one before. */
const [by, setBy] = persisted<By>('sum:by', oneOf(BYS.map(b => b.id)), 'week');

const label = (b: By, key: string): string => {
  if (b === 'week') return `${shortDate(key)} – ${shortDate(addDays(key, 6))}`;
  if (b === 'month') return `${MONTH_NAMES[+key.slice(5) - 1]} ${key.slice(0, 4)}`;
  if (b === 'weekday') return WEEKDAY_NAMES[+key]!;
  if (b === 'type') return key === 'day' ? 'Day' : key === 'night' ? 'Night' : 'No type';
  if (b === 'party') return key === 'party' ? 'Party' : 'No party';
  return key;
};

export function SummaryScreen() {
  const all = liveViews.value, views = scopedViews(all), b = by.value;
  const rows = summaryRows(views, b), s = summarize(views), time = isTime(b);

  const blank = <span class="nil">{DASH}</span>;
  const fig = (n: number) => (n ? <span class="fig">{dollars(n)}</span> : blank);
  const columns: Column<SumRow>[] = [
    { key: 'label', group: 'When', head: BYS.find(x => x.id === b)!.label, className: 'fit', sort: r => (time ? r.key : rows.indexOf(r)), cell: r => label(b, r.key) },
    { key: 'shifts', group: 'Work', groupStart: true, head: 'Shifts', className: 'r fit', sort: r => r.s.shifts, cell: r => <span class="fig">{r.s.shifts}</span> },
    { key: 'hours', group: 'Work', head: 'Hours', className: 'r fit', sort: r => r.s.hours, cell: r => <span class="fig">{hours(r.s.hours)}</span> },
    { key: 'tips', group: 'Pay', groupStart: true, head: 'Tips', className: 'r fit', sort: r => r.s.tips, cell: r => <span class="fig fig-key">{dollars(r.s.tips)}</span> },
    { key: 'wage', group: 'Pay', head: 'Wage', className: 'r fit', sort: r => r.s.wage, cell: r => fig(r.s.wage) },
    { key: 'other', group: 'Pay', head: 'Other', className: 'r fit', sort: r => r.s.extra, cell: r => fig(r.s.extra) },
    { key: 'total', group: 'Pay', head: 'Total', className: 'r fit', sort: r => r.s.total, cell: r => <span class="fig fig-key">{dollars(r.s.total)}</span> },
    { key: 'rate', group: 'Rate', groupStart: true, head: 'Rate', hint: 'Tips over hours. Not part of the total.', className: 'r fit soft', sort: r => r.s.tph, cell: r => (r.s.tph == null ? blank : <span class="fig">{money(r.s.tph)}</span>) },
    { key: 'crew', group: 'Crew', groupStart: true, head: 'Crew hrs', className: 'r fit', sort: r => r.s.crewHours, cell: r => (r.s.crewHours ? <span class="fig">{dec1(r.s.crewHours)}</span> : blank) },
    ...(time ? [{
      key: 'change', head: 'Vs last', className: 'fit', sort: (r: SumRow) => pctChange(r.s.total, r.prev?.total),
      cell: (r: SumRow) => (r.prev ? <DeltaPill pct={pctChange(r.s.total, r.prev.total)} /> : blank)
    }] satisfies Column<SumRow>[] : [])
  ];

  const table = ready.value && all.length === 0
    ? <FirstShiftEmpty>Totals appear here as you log shifts.</FirstShiftEmpty>
    : ready.value && views.length === 0
      ? <EmptyPeriod />
      : <Table log fill label="Totals" rows={rows} columns={columns} rowKey={r => r.key} defaultSort={time ? { key: 'label', dir: 'desc' } : undefined} key={b} />;

  return (
    <section class="panel fill" aria-labelledby="sum-title">
      <PanelHead title="Totals" id="sum-title">
        <div class="seg" role="radiogroup" aria-label="Group by">
          {BYS.map(x => <label key={x.id}><input type="radio" name="sum-by" checked={b === x.id} onChange={() => setBy(x.id)} /><span>{x.label}</span></label>)}
        </div>
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush data-sheet ${styles.body}`}>{table}</div>
        <SideStats items={periodItems(s)} note="Each row folds the shifts in that group. Rate is tips over hours." />
      </div>
    </section>
  );
}
