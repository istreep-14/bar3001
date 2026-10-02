import { signal } from '@preact/signals';
import { CATEGORIES } from '../../core/core.generated.js';
import type { Category } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { DASH, money, moneyWhole } from '../../lib/format.ts';
import { today } from '../../lib/dates.ts';
import { inDates } from '../../lib/trends.ts';
import { summarize } from '../../lib/stats.ts';
import { StatList } from '../../ui/kpi.tsx';
import type { ShiftView } from '../../lib/stats.ts';
import { DayLine } from '../../parts/DayLine.tsx';
import { openSheet, sheet } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MixKey } from '../../ui/MixBar.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SideStats } from '../../ui/SideStats.tsx';
import { MiniMonth } from '../../parts/MiniMonth.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import { Switcher } from '../../ui/Switcher.tsx';
import { TableTabs } from '../../ui/TableTabs.tsx';
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
const amountClass = (k: Kind) => (k === 'Tips' ? 'fig fig-key' : k === 'Wage' ? 'fig fig-q' : 'fig fig-semi');
/** Date and start first, so the Shift column orders the blocks by when they were; the id keeps two shifts that start together apart. */
const byShift = (r: Row) => r.v.shift.date + String(r.v.shift.start ?? 0).padStart(4, '0') + '\0' + r.v.shift.id;

/** Tips and wage are derived from the shift; Other rows are Income lines (plus a legacy shift.other if still set). */
function linesOf(v: ShiftView): Row[] {
  const out: Row[] = [];
  const sid = v.shift.id;
  if (v.shift.tips != null) {
    out.push({ id: `${sid}:tips`, v, category: 'Tips', type: null, amount: v.shift.tips, note: '' });
  }
  if (v.wage != null) {
    out.push({ id: `${sid}:wage`, v, category: 'Wage', type: null, amount: v.wage, note: 'Estimated' });
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
  const lines = views.flatMap(linesOf).filter(r => !typeFilter.value || (r.category === 'Other' && r.type === typeFilter.value));
  const rows = lines.filter(r => !cat.value || r.category === cat.value);
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const columns: Column<Row>[] = [
    { key: 'date', head: 'Shift', className: 'fit', once: true, sort: byShift,
      cell: r => <DayLine v={r.v} variant="line" showYear /> },
    { key: 'category', head: 'Category', className: 'fit', sort: r => KINDS.indexOf(r.category),
      cell: r => <span class="fig">{r.category}</span> },
    { key: 'type', head: 'Type', className: 'fit', sort: r => (r.type ? order(r.type) : -1), cell: r => {
      if (r.category !== 'Other' || !r.type) return nil;
      const token = r.type === 'Other' ? '--cat-other' : `--cat-${r.type.toLowerCase()}`;
      return <span class={styles.source}><MixKey token={token} />{r.type}</span>;
    } },
    { key: 'amount', head: 'Amount', className: 'r fit', sort: r => r.amount,
      cell: r => <span class={amountClass(r.category)}>{money(r.amount)}</span> },
    { key: 'note', head: 'Note', className: 'notes when', cell: r => r.note || nil },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first — tips, wage and other income show here.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No income in this period">Widen the period, or log tips / other income on a shift.</EmptyState>
    : <Table log fill paginate label="Income table" rows={rows} columns={columns} rowKey={r => r.id}
        onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        group={byShift} holdGroups="date"
        foot={{
          date: <span class="foot-label">{rows.length} line{rows.length === 1 ? '' : 's'} · {shifts} shift{shifts === 1 ? '' : 's'}</span>,
          amount: <span class="fig fig-key">{money(sum)}</span>
        }}
        defaultSort={{ key: 'date', dir: 'desc' }} />;

  return (
    <section class="panel fill" aria-label="Income table">
      <div class="split">
        <div class="tabbed">
          <TableTabs label="Which category" value={cat.value} onChange={v => { cat.value = v; if (v !== 'Other' && v !== '') typeFilter.value = ''; }}
            tabs={[{ value: '' as '' | Kind, label: 'All', count: lines.length }, ...KINDS.map(k => ({ value: k, label: k, count: lines.filter(r => r.category === k).length }))]}
            tools={<>
              <Switcher compact icon="dollar" label="Type" mark={typeFilter.value ? typeFilter.value.slice(0, 3) : undefined} value={typeFilter.value} disabled={cat.value !== '' && cat.value !== 'Other'} onChange={v => { typeFilter.value = v; }}
                choices={[{ value: '' as '' | Category | 'Other', label: 'All' }, ...CATEGORIES.map(c => ({ value: c, label: c })), { value: 'Other', label: 'Other' }]} />
              <ScopeControl compact />
              <AddToShift compact views={views} page="misc" label="Add income" />
            </>} />
          <div class={`data-sheet ${styles.body} ${styles.sheet}`}>{table}</div>
        </div>
        <SideStats items={[{ label: 'Lines', value: rows.length }, { label: 'Shifts', value: shifts || DASH }, { label: 'Total', value: moneyWhole(sum) }]}
          after={<>{isDesktop.value && <MiniMonth views={views} title="Calendar" />}<TaxYear /></>} />
      </div>
    </section>
  );
}

/* A stub for the tax year: this calendar year's money so far, by kind. The full summary (the tip deduction, an export
 * for whoever does your taxes) comes later; this is where it will live. */
function TaxYear() {
  const t = today(), y = t.slice(0, 4), s = summarize(inDates(liveViews.value, `${y}-01-01`, t));
  return (
    <div class="side-block">
      <h3 class="label">Tax year {y} so far</h3>
      <StatList items={[{ label: 'Tips', value: moneyWhole(s.tips) }, { label: 'Wage (est.)', value: moneyWhole(s.wage) }, { label: 'Other', value: moneyWhole(s.extra) }, { label: 'Total', value: moneyWhole(s.total) }]} />
      <p class="muted side-note">A full tax summary, with the tip deduction and an export, is coming.</p>
    </div>
  );
}
