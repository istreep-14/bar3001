import { signal } from '@preact/signals';
import { CATEGORIES } from '../../core/core.generated.js';
import type { Category, Income } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { DASH, money, moneyWhole } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openSheet, sheet } from '../../router.ts';
import { DayCell } from '../../ui/DayCell.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MixKey } from '../../ui/MixBar.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SideStats } from '../../ui/SideStats.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { AddToShift } from './AddToShift.tsx';
import styles from './Hub.module.css';

/* Other income: every income line besides tips and wage (chump, cash, Venmo, consideration, overtime), one line each, read
 * like the Log. A shift's lines sit together as one block that names the day once. A line opens its shift in the drawer,
 * whose pencil lands on the form's Other page; "Add to a shift" does the same for a shift with no lines yet.
 * An earlier free-form "other" amount on a shift is a line of its own until it is re-entered as a proper one. */
interface Row { v: ShiftView; line: Income | null; legacy?: number }
const cat = signal<'' | Category>('');
const order = (c: Category) => CATEGORIES.indexOf(c);

export function HubIncome() {
  const all = liveViews.value, views = scopedViews(all);
  const rows: Row[] = views.flatMap(v => [
    ...[...v.income].sort((a, b) => order(a.category) - order(b.category) || b.amount - a.amount).map((line): Row => ({ v, line })),
    ...(v.shift.other ? [{ v, line: null, legacy: v.shift.other } as Row] : [])
  ]).filter(r => !cat.value || r.line?.category === cat.value);
  const amount = (r: Row) => r.line?.amount ?? r.legacy ?? 0;
  const sum = rows.reduce((a, r) => a + amount(r), 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const columns: Column<Row>[] = [
    { key: 'date', head: 'Shift', once: true, sort: r => r.v.shift.date + (r.v.shift.start ?? 0).toString().padStart(4, '0'),
      cell: r => <DayCell date={r.v.shift.date} type={r.v.shift.shift_type} party={r.v.shift.party} /> },
    { key: 'cat', head: 'Source', sort: r => r.line ? order(r.line.category) : 99, cell: r => (
      <span class={styles.source}><MixKey token={r.line ? `--cat-${r.line.category.toLowerCase()}` : '--cat-other'} />{r.line ? r.line.category : 'Other'}</span>
    ) },
    { key: 'amount', head: 'Amount', className: 'r fit strong num', sort: amount, cell: r => money(amount(r)) },
    { key: 'note', head: 'Note', className: 'notes when', cell: r => r.line ? r.line.note ?? '' : 'Earlier entry' },
    { key: 'go', head: '', className: 'chev', once: true, cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then add its extra income.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No other income in this period">Widen the period, or add some to a shift with Add to a shift.</EmptyState>
    : <Table log fill paginate label="Other income" rows={rows} columns={columns} rowKey={r => r.line?.id ?? r.v.shift.id + ':other'}
        group={r => r.v.shift.id} onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        defaultSort={{ key: 'date', dir: 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hi-title">
      <PanelHead title="Other income" id="hi-title">
        <label class={styles.filter}><span class="sr-only">Source</span>
          <select class="input" value={cat.value} onChange={e => { cat.value = e.currentTarget.value as '' | Category; }} aria-label="Show one source">
            <option value="">All sources</option>
            {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <AddToShift views={views} page="misc" label="Add income to a shift" />
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush ${styles.body}`}>{table}</div>
        <SideStats items={[{ label: 'Lines', value: rows.length }, { label: 'Shifts', value: shifts || DASH }, { label: 'Total', value: moneyWhole(sum) }]} />
      </div>
    </section>
  );
}
