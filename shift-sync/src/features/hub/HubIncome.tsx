import { signal } from '@preact/signals';
import { CATEGORIES } from '../../core/core.generated.js';
import type { Category } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { DASH, fullDate, money, moneyWhole, yearTag } from '../../lib/format.ts';
import { dayBadge } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openSheet, sheet } from '../../router.ts';
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

/* Income table: every money line on a shift — Tips, estimated Wage, and Other income — one row each.
 * Same condensed sheet as the Shift table. Category is one of three; Type is only filled for Other. */
type Kind = 'Tips' | 'Wage' | 'Other';
interface Row {
  id: string;
  v: ShiftView;
  category: Kind;
  /** Other-income source (Chump, Cash, …), or null for Tips / Wage. */
  type: Category | 'Other' | null;
  amount: number;
  note: string;
}

const cat = signal<'' | Kind>('');
const typeFilter = signal<'' | Category | 'Other'>('');
const KINDS: Kind[] = ['Tips', 'Wage', 'Other'];
const order = (c: Category | 'Other') => (c === 'Other' ? 99 : CATEGORIES.indexOf(c));
const nil = <span class="nil">{DASH}</span>;

function DayLine({ date }: { date: string }) {
  const { month, day, weekday } = dayBadge(date);
  const year = yearTag(date);
  return (
    <span class={styles.day} title={fullDate(date)}>
      <span class={styles.wd}>{weekday}</span>
      <span class={styles.date}>{month} {day}</span>
      {year && <span class={styles.year}>{year}</span>}
    </span>
  );
}

/** Tips and wage are derived from the shift; Other rows are Income lines (plus a legacy shift.other if still set). */
function linesOf(v: ShiftView): Row[] {
  const out: Row[] = [];
  const sid = v.shift.id;
  if (v.shift.tips != null) {
    out.push({ id: `${sid}:tips`, v, category: 'Tips', type: null, amount: v.shift.tips, note: '' });
  }
  if (v.wage != null) {
    out.push({ id: `${sid}:wage`, v, category: 'Wage', type: null, amount: v.wage, note: '' });
  }
  for (const line of [...v.income].sort((a, b) => order(a.category) - order(b.category) || b.amount - a.amount)) {
    out.push({ id: line.id, v, category: 'Other', type: line.category, amount: line.amount, note: line.note ?? '' });
  }
  if (v.shift.other) {
    out.push({ id: `${sid}:other`, v, category: 'Other', type: 'Other', amount: v.shift.other, note: 'Earlier entry' });
  }
  return out;
}

export function HubIncome() {
  const all = liveViews.value, views = scopedViews(all);
  const rows = views.flatMap(linesOf).filter(r => {
    if (cat.value && r.category !== cat.value) return false;
    if (typeFilter.value && (r.category !== 'Other' || r.type !== typeFilter.value)) return false;
    return true;
  });
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const columns: Column<Row>[] = [
    { key: 'date', group: 'Shift', head: 'Shift', className: 'fit', sort: r => r.v.shift.date + (r.v.shift.start ?? 0).toString().padStart(4, '0'),
      cell: r => <DayLine date={r.v.shift.date} /> },
    { key: 'category', group: 'Line', groupStart: true, head: 'Category', className: 'fit', sort: r => KINDS.indexOf(r.category),
      cell: r => <span class="fig">{r.category}</span> },
    { key: 'type', group: 'Line', head: 'Type', className: 'fit', sort: r => (r.type ? order(r.type) : -1), cell: r => {
      if (r.category !== 'Other' || !r.type) return nil;
      const token = r.type === 'Other' ? '--cat-other' : `--cat-${r.type.toLowerCase()}`;
      return <span class={styles.source}><MixKey token={token} />{r.type}</span>;
    } },
    { key: 'amount', group: 'Line', head: 'Amount', className: 'r fit', sort: r => r.amount,
      cell: r => <span class="fig fig-key">{money(r.amount)}</span> },
    { key: 'note', group: 'Line', head: 'Note', className: 'notes when', cell: r => r.note || nil },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first — tips, wage and other income show here.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No income in this period">Widen the period, or log tips / other income on a shift.</EmptyState>
    : <Table log fill paginate label="Income table" rows={rows} columns={columns} rowKey={r => r.id}
        onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        defaultSort={{ key: 'date', dir: 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hi-title">
      <PanelHead title="Income table" id="hi-title">
        <label class={styles.filter}><span class="sr-only">Category</span>
          <select class="input" value={cat.value} onChange={e => { cat.value = e.currentTarget.value as '' | Kind; if (e.currentTarget.value !== 'Other') typeFilter.value = ''; }} aria-label="Show one category">
            <option value="">All categories</option>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label class={styles.filter}><span class="sr-only">Type</span>
          <select class="input" value={typeFilter.value} disabled={cat.value !== '' && cat.value !== 'Other'}
            onChange={e => { typeFilter.value = e.currentTarget.value as '' | Category | 'Other'; }} aria-label="Show one other-income type">
            <option value="">All types</option>
            {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
            <option value="Other">Other</option>
          </select>
        </label>
        <AddToShift views={views} page="misc" label="Add income to a shift" />
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush data-sheet ${styles.body} ${styles.sheet}`}>{table}</div>
        <SideStats items={[{ label: 'Lines', value: rows.length }, { label: 'Shifts', value: shifts || DASH }, { label: 'Total', value: moneyWhole(sum) }]} />
      </div>
    </section>
  );
}
