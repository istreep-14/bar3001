import { signal } from '@preact/signals';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { addDays } from '../../lib/dates.ts';
import { dec1, hours, moneyWhole, shortDate } from '../../lib/format.ts';
import { BYS, isTime, summaryRows } from '../../lib/summary.ts';
import type { By, SumRow } from '../../lib/summary.ts';
import { summarize } from '../../lib/stats.ts';
import { pctChange } from '../../lib/trends.ts';
import { openForm } from '../../router.ts';
import { Cur } from '../../ui/Cur.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { DeltaPill, MiniStat } from '../../ui/kpi.tsx';
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

  const columns: Column<SumRow>[] = [
    { key: 'label', head: BYS.find(x => x.id === b)!.label, group: 'Group', className: 'strong l datecol', sort: r => (time ? r.key : rows.indexOf(r)), cell: r => label(b, r.key) },
    { key: 'n', head: 'CT', hint: 'Shifts', group: 'Group', className: 'mute', sort: r => r.s.shifts, cell: r => r.s.shifts },
    { key: 'hours', head: 'HR', hint: 'Hours worked', group: 'Time', groupStart: true, className: 'strong', sort: r => r.s.hours, cell: r => dec1(r.s.hours) },
    { key: 'tips', head: 'Tips', group: 'Tips', groupStart: true, className: 'strong tight', sort: r => r.s.tips, cell: r => <Cur n={r.s.tips} /> },
    { key: 'rate', head: 'RATE', hint: 'Tips per hour worked (tips only)', group: 'Tips', className: 'mute tight', sort: r => r.s.tph, cell: r => dec1(r.s.tph) },
    { key: 'wage', head: 'Wage', group: 'Income', groupStart: true, sort: r => r.s.wage, cell: r => <Cur n={r.s.wage || null} /> },
    { key: 'other', head: 'Other', group: 'Income', sort: r => r.s.extra, cell: r => <Cur n={r.s.extra || null} /> },
    { key: 'total', head: 'Total', group: 'Income', className: 'strong tight', sort: r => r.s.total, cell: r => <Cur n={r.s.total} /> },
    { key: 'perhr', head: 'RATE', hint: 'Everything earned per hour worked', group: 'Income', className: 'mute tight', sort: r => r.s.perHour, cell: r => dec1(r.s.perHour) },
    { key: 'crewh', head: 'HR', hint: 'Hours, all bartenders added up', group: 'Staff', groupStart: true, className: 'mute', sort: r => r.s.crewHours, cell: r => (r.s.crewHours ? dec1(r.s.crewHours) : '—') },
    ...(time ? [
      { key: 'dtotal', head: 'Total', hint: 'Total income against the period before', group: 'Change', groupStart: true, sort: (r: SumRow) => pctChange(r.s.total, r.prev?.total), cell: (r: SumRow) => <DeltaPill pct={pctChange(r.s.total, r.prev?.total)} /> },
      { key: 'drate', head: 'RATE', hint: 'Tips per hour against the period before', group: 'Change', sort: (r: SumRow) => pctChange(r.s.tph, r.prev?.tph), cell: (r: SumRow) => <DeltaPill pct={pctChange(r.s.tph, r.prev?.tph)} /> }
    ] satisfies Column<SumRow>[] : [])
  ];

  return (
    <section class={`panel ${styles.screen}`} aria-labelledby="sum-title">
      <PanelHead title="Summary" id="sum-title">
        <div class="seg" role="radiogroup" aria-label="Group by">
          {BYS.map(x => <label key={x.id}><input type="radio" name="sum-by" checked={b === x.id} onChange={() => setBy(x.id)} /><span>{x.label}</span></label>)}
        </div>
        <ScopeControl />
      </PanelHead>
      <div class={`panel-body flush ${styles.body}`}>
        {ready.value && all.length === 0 ? (
          <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> Add shift</button>}>Totals appear here as you log shifts.</EmptyState>
        ) : ready.value && views.length === 0 ? (
          <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>
        ) : (
          <Table fill label="Summary" rows={rows} columns={columns} rowKey={r => r.key} defaultSort={time ? { key: 'label', dir: 'desc' } : undefined} key={b}
            footer={<span class={styles.foot}><MiniStat label="Shifts" value={s.shifts} /><MiniStat label="Hours" value={hours(s.hours)} /><MiniStat label="Tips" value={moneyWhole(s.tips)} /><MiniStat label="Rate" value={s.tph == null ? '—' : `$${s.tph.toFixed(1)}/hr`} hint="Tips over hours worked" /><MiniStat label="Total" value={moneyWhole(s.total)} /></span>} />
        )}
      </div>
    </section>
  );
}
