import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { hoursWorked, toHHMM, toMin } from '../../core/core.generated.js';
import type { Crew } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveStaff, liveViews, personById, ready, removeCrewLine, saveCrewLine } from '../../data/store.ts';
import { dateCell, dec1, weekdayShort } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { TypeBadge } from '../../ui/Badges.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { TimeField } from '../../ui/TimeField.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { Stack } from '../../ui/Stack.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './Hub.module.css';

/* Crew log: every bartender's hours on every shift in the period, one row each. Times edit in place (a change saves when you leave the
 * cell); the hours are worked out from them. Add a line for any shift with the bar on top. */
interface Row { v: ShiftView; c: Crew; name: string }
const who = signal('');

const run = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Could not save'); } };
const shiftLabel = (v: ShiftView) => `${weekdayShort(v.shift.date)} ${dateCell(v.shift.date)}${v.shift.shift_type ? ' · ' + v.shift.shift_type : ''}`;

export function HubCrew() {
  const all = liveViews.value, views = scopedViews(all);
  const rows: Row[] = views.flatMap(v => v.crew.map(c => ({ v, c, name: personById(c.staff_id)?.name ?? c.name ?? 'Unknown' })))
    .filter(r => !who.value || r.c.staff_id === who.value);
  const hoursSum = rows.reduce((a, r) => a + (hoursWorked(r.c.start, r.c.end) ?? 0), 0);
  const time = (r: Row, key: 'start' | 'end') => (
    <TimeField compact label={`${r.name} ${key} on ${r.v.shift.date}`} value={toHHMM(r.c[key])} pm={key === 'start'}
      onChange={v => { const m = v ? toMin(v) : null; void run(() => saveCrewLine({ id: r.c.id, shift_id: r.c.shift_id, staff_id: r.c.staff_id, start: key === 'start' ? m : r.c.start, end: key === 'end' ? m : r.c.end })); }} />
  );
  const columns: Column<Row>[] = [
    { key: 'date', head: 'Shift', sort: r => r.v.shift.date, cell: r => (
      <Stack title={<>{weekdayShort(r.v.shift.date)} {dateCell(r.v.shift.date)}</>} extra={r.v.shift.shift_type ? <span class="stack-row"><TypeBadge type={r.v.shift.shift_type} /></span> : undefined} />
    ) },
    { key: 'name', head: 'Bartender', sort: r => r.name, cell: r => <>{r.name}{personById(r.c.staff_id)?.is_user && <span class="stack-meta"> · you</span>}</> },
    { key: 'start', head: 'Start', className: 'fit', cell: r => time(r, 'start') },
    { key: 'end', head: 'End', className: 'fit', cell: r => time(r, 'end') },
    { key: 'hours', head: 'Hours', className: 'fit', sort: r => hoursWorked(r.c.start, r.c.end), cell: r => dec1(hoursWorked(r.c.start, r.c.end)) },
    { key: 'del', head: '', className: 'act', cell: r => (
      <button type="button" class="btn btn-quiet btn-icon" aria-label={`Remove ${r.name} from ${r.v.shift.date}`}
        onClick={() => void run(async () => { const gone = await removeCrewLine(r.c.id); if (gone) toast(`${r.name} removed`, { label: 'Undo', run: () => void saveCrewLine({ shift_id: gone.shift_id, staff_id: gone.staff_id, start: gone.start, end: gone.end }) }); })}><Icon name="trash" /></button>) }
  ];
  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then set who worked it.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No crew hours in this period">Widen the period, or add a line above.</EmptyState>
    : <Table fill paginate label="Crew hours" rows={rows} columns={columns} rowKey={r => r.c.id} defaultSort={{ key: 'date', dir: 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hc-title">
      <PanelHead title="Every shift" id="hc-title">
        <label class={styles.filter}><span class="sr-only">Bartender</span>
          <select class="input" value={who.value} onChange={e => { who.value = e.currentTarget.value; }} aria-label="Show one bartender">
            <option value="">Everyone</option>
            {liveStaff.value.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush ${styles.body}`}>
          <AddCrew views={views} />
          {table}
        </div>
        <aside class="panel-body side" aria-label="This period">
          <div class="side-block">
            <h3 class="label">This period</h3>
            <StatList items={[{ label: 'Lines', value: rows.length }, { label: 'Hours', value: dec1(hoursSum), hint: 'Each bartender’s hours, added up' }]} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function AddCrew({ views }: { views: ShiftView[] }) {
  const recent = views.slice(0, 200);
  const [shiftId, setShiftId] = useState('');
  const [staff, setStaff] = useState('');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const v = recent.find(x => x.shift.id === shiftId);
  const s = start ?? (v ? toHHMM(v.shift.start) : ''), e = end ?? (v ? toHHMM(v.shift.end) : '');
  const ok = !!v && !!staff;
  return (
    <form class={styles.bar} onSubmit={ev => { ev.preventDefault(); if (!ok) return; void run(async () => { await saveCrewLine({ shift_id: shiftId, staff_id: staff, start: toMin(s), end: toMin(e) }); setStaff(''); setStart(null); setEnd(null); }); }}>
      <label class="field"><span class="label-text">Shift</span>
        <select class="input" value={shiftId} onChange={ev => { setShiftId(ev.currentTarget.value); setStart(null); setEnd(null); }}>
          <option value="">Choose a shift…</option>
          {recent.map(x => <option key={x.shift.id} value={x.shift.id}>{shiftLabel(x)}</option>)}
        </select>
      </label>
      <label class="field"><span class="label-text">Bartender</span>
        <select class="input" value={staff} onChange={ev => setStaff(ev.currentTarget.value)}>
          <option value="">Choose…</option>
          {liveStaff.value.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <TimeField label="Start" value={s} onChange={setStart} />
      <TimeField label="End" value={e} pm={false} onChange={setEnd} />
      <button class="btn btn-primary" type="submit" disabled={!ok}><Icon name="plus" /> Add</button>
    </form>
  );
}
