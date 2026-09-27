import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { CATEGORIES } from '../../core/core.generated.js';
import type { Category, Income } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready, removeIncomeLine, saveIncomeLine } from '../../data/store.ts';
import { dateCell, dollars, moneyWhole, weekdayShort } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { TypeBadge } from '../../ui/Badges.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { Stack } from '../../ui/Stack.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './Hub.module.css';

/* Other income: every income line besides tips and wage (chump, cash, Venmo, consideration, overtime), one row each, editable in place.
 * An earlier free-form "other" amount on a shift shows as a read-only row until you re-enter it as a line. */
interface Row { v: ShiftView; line: Income | null; legacy?: number }
const cat = signal<'' | Category>('');
const run = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Could not save'); } };
const shiftLabel = (v: ShiftView) => `${weekdayShort(v.shift.date)} ${dateCell(v.shift.date)}${v.shift.shift_type ? ' · ' + v.shift.shift_type : ''}`;

export function HubIncome() {
  const all = liveViews.value, views = scopedViews(all);
  const rows: Row[] = views.flatMap(v => [
    ...v.income.map((line): Row => ({ v, line })),
    ...(v.shift.other ? [{ v, line: null, legacy: v.shift.other } as Row] : [])
  ]).filter(r => !cat.value || r.line?.category === cat.value);
  const sum = rows.reduce((a, r) => a + (r.line?.amount ?? r.legacy ?? 0), 0);
  const save = (r: Row, patch: Partial<Pick<Income, 'category' | 'amount' | 'note'>>) =>
    void run(() => saveIncomeLine({ id: r.line!.id, shift_id: r.line!.shift_id, category: patch.category ?? r.line!.category, amount: patch.amount ?? r.line!.amount, note: 'note' in patch ? patch.note ?? null : r.line!.note }));

  const columns: Column<Row>[] = [
    { key: 'date', head: 'Shift', sort: r => r.v.shift.date, cell: r => (
      <Stack title={<>{weekdayShort(r.v.shift.date)} {dateCell(r.v.shift.date)}</>} extra={r.v.shift.shift_type ? <span class="stack-row"><TypeBadge type={r.v.shift.shift_type} /></span> : undefined} />
    ) },
    { key: 'cat', head: 'Source', sort: r => r.line?.category ?? 'zz', cell: r => r.line
      ? <select class={styles.cellin} value={r.line.category} aria-label="Source" onChange={e => save(r, { category: e.currentTarget.value as Category })}>{CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}</select>
      : <span class="muted">Other (earlier entry)</span> },
    { key: 'amount', head: 'Amount', className: 'fit', sort: r => r.line?.amount ?? r.legacy ?? 0, cell: r => r.line
      ? <input class={styles.cellin} type="number" step="0.01" defaultValue={r.line.amount} key={r.line.id + r.line.amount} aria-label="Amount"
          onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) save(r, { amount: n }); }} />
      : dollars(r.legacy ?? 0) },
    { key: 'note', head: 'Note', className: 'notes', cell: r => r.line
      ? <input class={`${styles.cellin} ${styles.left}`} type="text" defaultValue={r.line.note ?? ''} key={r.line.id + (r.line.note ?? '')} placeholder="Add a note" aria-label="Note"
          onChange={e => save(r, { note: e.currentTarget.value.trim() || null })} />
      : '' },
    { key: 'del', head: '', className: 'act', cell: r => r.line ? (
      <button type="button" class="btn btn-quiet btn-icon" aria-label="Remove this income line"
        onClick={() => void run(async () => { const gone = await removeIncomeLine(r.line!.id); if (gone) toast('Income removed', { label: 'Undo', run: () => void saveIncomeLine({ shift_id: gone.shift_id, category: gone.category, amount: gone.amount, note: gone.note }) }); })}><Icon name="trash" /></button>) : null }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then add its extra income.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No other income in this period">Widen the period, or add a line above.</EmptyState>
    : <Table fill paginate label="Other income" rows={rows} columns={columns} rowKey={r => r.line?.id ?? r.v.shift.id + ':other'} defaultSort={{ key: 'date', dir: 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hi-title">
      <PanelHead title="Other income" id="hi-title">
        <label class={styles.filter}><span class="sr-only">Source</span>
          <select class="input" value={cat.value} onChange={e => { cat.value = e.currentTarget.value as '' | Category; }} aria-label="Show one source">
            <option value="">All sources</option>
            {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush ${styles.body}`}>
          <AddIncome views={views} />
          {table}
        </div>
        <aside class="panel-body side" aria-label="This period">
          <div class="side-block">
            <h3 class="label">This period</h3>
            <StatList items={[{ label: 'Lines', value: rows.length }, { label: 'Total', value: moneyWhole(sum) }]} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function AddIncome({ views }: { views: ShiftView[] }) {
  const recent = views.slice(0, 200);
  const [shiftId, setShiftId] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0] as Category);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const n = Number(amount), ok = !!shiftId && amount.trim() !== '' && Number.isFinite(n);
  return (
    <form class={styles.bar} onSubmit={ev => { ev.preventDefault(); if (!ok) return; void run(async () => { await saveIncomeLine({ shift_id: shiftId, category, amount: n, note: note.trim() || null }); setAmount(''); setNote(''); }); }}>
      <label class="field"><span class="label-text">Shift</span>
        <select class="input" value={shiftId} onChange={ev => setShiftId(ev.currentTarget.value)}>
          <option value="">Choose a shift…</option>
          {recent.map(x => <option key={x.shift.id} value={x.shift.id}>{shiftLabel(x)}</option>)}
        </select>
      </label>
      <label class="field"><span class="label-text">Source</span>
        <select class="input" value={category} onChange={ev => setCategory(ev.currentTarget.value as Category)}>{CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}</select>
      </label>
      <label class="field"><span class="label-text">Amount</span><input class="input" type="number" step="0.01" inputMode="decimal" value={amount} onInput={ev => setAmount(ev.currentTarget.value)} /></label>
      <label class="field"><span class="label-text">Note</span><input class="input" type="text" value={note} onInput={ev => setNote(ev.currentTarget.value)} /></label>
      <button class="btn btn-primary" type="submit" disabled={!ok}><Icon name="plus" /> Add</button>
    </form>
  );
}
