import { signal } from '@preact/signals';
import { CATEGORIES } from '../../core/core.generated.js';
import type { Category, Income } from '../../core/core.generated.js';
import { oneOf, persisted } from '../../data/persisted.ts';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { clockShort, longDate, money, moneyWhole } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openSheet, sheet } from '../../router.ts';
import { DayCell } from '../../ui/DayCell.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { KpiStrip } from '../../ui/kpi.tsx';
import { MixKey } from '../../ui/MixBar.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { AddToShift } from './AddToShift.tsx';
import styles from './Hub.module.css';

/* Other income: every income line besides tips and wage, one line each. Default is a self-contained row with its
 * own date. "Group by date" hides the Date column and names the day on a band. A line opens its shift in the drawer. */
interface Row { v: ShiftView; line: Income | null; legacy?: number }
const cat = signal<'' | Category>('');
const [groupDates, setGroupDates] = persisted('income:group-date', oneOf(['on', 'off'] as const), 'off');
const order = (c: Category) => CATEGORIES.indexOf(c);

export function HubIncome() {
  const all = liveViews.value, views = scopedViews(all);
  const grouped = groupDates.value === 'on';
  const rows: Row[] = views.flatMap(v => [
    ...[...v.income].sort((a, b) => order(a.category) - order(b.category) || b.amount - a.amount).map((line): Row => ({ v, line })),
    ...(v.shift.other ? [{ v, line: null, legacy: v.shift.other } as Row] : [])
  ]).filter(r => !cat.value || r.line?.category === cat.value);
  const amount = (r: Row) => r.line?.amount ?? r.legacy ?? 0;
  const sum = rows.reduce((a, r) => a + amount(r), 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const dateCol: Column<Row> = {
    key: 'date', head: 'Date', weight: 1.5,
    sort: r => r.v.shift.date + (r.v.shift.start ?? 0).toString().padStart(4, '0'),
    cell: r => (
      <span class="cell-lines">
        <DayCell date={r.v.shift.date} type={r.v.shift.shift_type} party={r.v.shift.party} />
        {r.v.shift.start != null && <span class="stack-meta">{clockShort(r.v.shift.start)}</span>}
      </span>
    )
  };
  const columns: Column<Row>[] = [
    ...(!grouped ? [dateCol] : []),
    { key: 'cat', head: 'Source', weight: 1.3, sort: r => r.line ? order(r.line.category) : 99, cell: r => (
      <span class={styles.source}><MixKey token={r.line ? `--cat-${r.line.category.toLowerCase()}` : '--cat-other'} />{r.line ? r.line.category : 'Other'}</span>
    ) },
    { key: 'amount', head: 'Amount', className: 'r', weight: 1, sort: amount, cell: r => <span class="fig fig-key">{money(amount(r))}</span> },
    { key: 'note', head: 'Note', className: 'notes', fill: true, cell: r => r.line ? r.line.note ?? '' : 'Earlier entry' },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then add its extra income.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No other income in this period">Widen the period, or add some to a shift with Add to a shift.</EmptyState>
    : <Table log fill paginate separators label="Other income" rows={rows} columns={columns} rowKey={r => r.line?.id ?? r.v.shift.id + ':other'}
        group={grouped ? r => r.v.shift.date : undefined} groupLabel={grouped ? d => longDate(d) : undefined} holdGroups={grouped ? 'date' : undefined}
        onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        defaultSort={{ key: grouped ? 'cat' : 'date', dir: grouped ? 'asc' : 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hi-title">
      <PanelHead title="Other income" id="hi-title">
        <AddToShift views={views} page="misc" label="Add income to a shift" />
      </PanelHead>
      <div class={`panel-body flush list-sheet ${styles.body}`}>
        <KpiStrip label="Other income in this period" items={[
          { label: 'Lines', value: rows.length, icon: 'table' },
          { label: 'Shifts', value: shifts, icon: 'log' },
          { label: 'Total', value: moneyWhole(sum), icon: 'dollar' }
        ]} />
        <div class="sheet-bar">
          <label class={styles.filter}><span class="sr-only">Source</span>
            <select class="input" value={cat.value} onChange={e => { cat.value = e.currentTarget.value as '' | Category; }} aria-label="Show one source">
              <option value="">All sources</option>
              {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div class="sheet-bar-end">
            <button type="button" class="tog" aria-pressed={grouped} onClick={() => setGroupDates(grouped ? 'off' : 'on')}>Group by date</button>
            <ScopeControl />
          </div>
        </div>
        {table}
      </div>
    </section>
  );
}
