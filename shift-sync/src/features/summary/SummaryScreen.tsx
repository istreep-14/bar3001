import { signal } from '@preact/signals';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { addDays } from '../../lib/dates.ts';
import { dec1, dollars, hours, moneyWhole, perHour, shortDate } from '../../lib/format.ts';
import { BYS, isTime, summaryRows } from '../../lib/summary.ts';
import type { By, SumRow } from '../../lib/summary.ts';
import { summarize } from '../../lib/stats.ts';
import { pctChange } from '../../lib/trends.ts';
import { openForm } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { DeltaPill, StatList } from '../../ui/kpi.tsx';
import { Stack } from '../../ui/Stack.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import styles from './SummaryScreen.module.css';

/* Summary: the Log's grouped-row totals as a table of their own. Fold the shifts in the period into weeks, months, years, weekdays,
 * types or party / no party, and see every column summed for each; time groups also show the change against the one before. */
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const by = signal<By>((() => { try { const v = localStorage.getItem('sum:by'); return BYS.some(b => b.id === v) ? (v as By) : 'week'; } catch { return 'week'; } })());
const setBy = (b: By) => { by.value = b; try { localStorage.setItem('sum:by', b); } catch { /* private mode */ } };

const label = (b: By, key: string): string => {
  if (b === 'week') return `${shortDate(key)} – ${shortDate(addDays(key, 6))}`;
  if (b === 'month') return `${MONTHS[+key.slice(5) - 1]} ${key.slice(0, 4)}`;
  if (b === 'weekday') return WEEKDAYS[+key]!;
  if (b === 'type') return key === 'day' ? 'Day' : key === 'night' ? 'Night' : 'No type';
  if (b === 'party') return key === 'party' ? 'Party' : 'No party';
  return key;
};

export function SummaryScreen() {
  const all = liveViews.value, views = scopedViews(all), b = by.value;
  const rows = summaryRows(views, b), s = summarize(views), time = isTime(b);

  const earnedLines = (r: SumRow) => {
    const more = [r.s.wage ? `Wage ${dollars(r.s.wage)}` : '', r.s.extra ? `Other ${dollars(r.s.extra)}` : ''].filter(Boolean).join(' · ');
    return [more, r.s.perHour == null ? '' : `${perHour(r.s.perHour)} all-in`].filter(Boolean);
  };
  const columns: Column<SumRow>[] = [
    { key: 'label', head: BYS.find(x => x.id === b)!.label, sort: r => (time ? r.key : rows.indexOf(r)), cell: r => (
      <Stack title={label(b, r.key)} lines={[`${r.s.shifts} shift${r.s.shifts === 1 ? '' : 's'} · ${dec1(r.s.hours)} hr`]} />
    ) },
    { key: 'tips', head: 'Tips', sort: r => r.s.tips, cell: r => <Stack title={dollars(r.s.tips)} lines={[perHour(r.s.tph)]} /> },
    { key: 'total', head: 'Earned', sort: r => r.s.total, cell: r => <Stack title={dollars(r.s.total)} lines={earnedLines(r)} /> },
    { key: 'crew', head: 'Crew', className: 'fit hide-sm', sort: r => r.s.crewHours, cell: r => (r.s.crewHours ? `${dec1(r.s.crewHours)} hr` : '—') },
    ...(time ? [{
      key: 'change', head: 'Vs previous', className: 'hide-sm', sort: (r: SumRow) => pctChange(r.s.total, r.prev?.total),
      cell: (r: SumRow) => (
        <span class="stack">
          <span class="stack-row">{r.prev ? <DeltaPill pct={pctChange(r.s.total, r.prev.total)} /> : '—'} <span class="stack-meta">total</span></span>
          <span class="stack-row">{r.prev ? <DeltaPill pct={pctChange(r.s.tph, r.prev.tph)} /> : null} <span class="stack-meta">tips/hr</span></span>
        </span>
      )
    }] satisfies Column<SumRow>[] : [])
  ];

  const table = ready.value && all.length === 0
    ? <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> Add shift</button>}>Totals appear here as you log shifts.</EmptyState>
    : ready.value && views.length === 0
      ? <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>
      : <Table fill label="Summary" rows={rows} columns={columns} rowKey={r => r.key} defaultSort={time ? { key: 'label', dir: 'desc' } : undefined} key={b} />;

  return (
    <section class="panel fill" aria-labelledby="sum-title">
      <PanelHead title="Totals" id="sum-title">
        <div class="seg" role="radiogroup" aria-label="Group by">
          {BYS.map(x => <label key={x.id}><input type="radio" name="sum-by" checked={b === x.id} onChange={() => setBy(x.id)} /><span>{x.label}</span></label>)}
        </div>
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush ${styles.body}`}>{table}</div>
        <aside class="panel-body side" aria-label="This period">
          <div class="side-block">
            <h3 class="label">This period</h3>
            <StatList items={[
              { label: 'Shifts', value: s.shifts },
              { label: 'Hours', value: hours(s.hours) },
              { label: 'Tips', value: moneyWhole(s.tips) },
              { label: 'Rate', value: perHour(s.tph), hint: 'Tips over hours worked' },
              { label: 'Total', value: moneyWhole(s.total), hint: 'Tips, estimated wage and other income' }
            ]} />
            <p class="muted side-note">Each row folds the shifts in that group. Rate is tips over hours.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
