import { signal } from '@preact/signals';
import { hoursWorked } from '../../core/core.generated.js';
import type { Crew } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveStaff, liveViews, personById, ready } from '../../data/store.ts';
import { DASH, clockShort, dec1, hours } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { openSheet, sheet } from '../../router.ts';
import { DayCell } from '../../ui/DayCell.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SideStats } from '../../ui/SideStats.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { AddToShift } from './AddToShift.tsx';
import styles from './Hub.module.css';

/* Crew, every shift: each bartender's time on each shift in the period, one line each, read like the Log. A shift's crew
 * sits together as one block that names the day once (you first, then by start). A line opens its shift in the drawer,
 * whose pencil lands on the form's Crew page; "Add to a shift" does the same for a shift with no crew yet. */
interface Row { v: ShiftView; c: Crew; name: string; me: boolean }
const who = signal('');

const clock = (t: number | null) => (t == null ? <span class="nil">{DASH}</span> : clockShort(t));

export function HubCrew() {
  const all = liveViews.value, views = scopedViews(all);
  const rows: Row[] = views.flatMap(v => v.crew
    .map(c => { const p = personById(c.staff_id); return { v, c, name: p?.name ?? c.name ?? 'Unknown', me: !!p?.is_user }; })
    .sort((a, b) => Number(b.me) - Number(a.me) || (a.c.start ?? 9999) - (b.c.start ?? 9999) || a.name.localeCompare(b.name)))
    .filter(r => !who.value || r.c.staff_id === who.value);
  const h = (r: Row) => hoursWorked(r.c.start, r.c.end);
  const hoursSum = rows.reduce((a, r) => a + (h(r) ?? 0), 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const columns: Column<Row>[] = [
    { key: 'date', group: 'Shift', head: 'Shift', once: true, sort: r => r.v.shift.date + (r.v.shift.start ?? 0).toString().padStart(4, '0'),
      cell: r => <DayCell date={r.v.shift.date} type={r.v.shift.shift_type} party={r.v.shift.party} /> },
    { key: 'name', group: 'Who', groupStart: true, head: 'Bartender', sort: r => r.name, cell: r => (
      <span class="who"><PersonAvatar id={r.c.staff_id} fallback={r.c.name} size="sm" /><span class="who-name">{r.name}</span>{r.me && <MeBadge />}</span>
    ) },
    { key: 'start', group: 'Time', groupStart: true, head: 'Start', className: 'r fit', sort: r => r.c.start, cell: r => clock(r.c.start) },
    { key: 'end', group: 'Time', head: 'End', className: 'r fit', sort: r => r.c.end, cell: r => clock(r.c.end) },
    { key: 'hours', group: 'Time', head: 'Hours', className: 'r fit', sort: h, cell: r => <span class="fig">{hours(h(r))}</span> },
    { key: 'station', group: 'Station', groupStart: true, head: 'Station', sort: r => r.c.location, cell: r => (r.c.location ? <span class="spot" data-spot={r.c.location}>{r.c.location}</span> : <span class="nil">{DASH}</span>) },
    { key: 'go', head: '', className: 'chev when', once: true, cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then set who worked it.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No crew hours in this period">Widen the period, or set who worked a shift with Add to a shift.</EmptyState>
    : <Table log fill paginate label="Crew hours" rows={rows} columns={columns} rowKey={r => r.c.id}
        group={r => r.v.shift.id} onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        defaultSort={{ key: 'date', dir: 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hc-title">
      <PanelHead title="Every shift" id="hc-title">
        <label class={styles.filter}><span class="sr-only">Bartender</span>
          <select class="input" value={who.value} onChange={e => { who.value = e.currentTarget.value; }} aria-label="Show one bartender">
            <option value="">Everyone</option>
            {liveStaff.value.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <AddToShift views={views} page="crew" label="Set the crew of a shift" />
        <ScopeControl />
      </PanelHead>
      <div class="split">
        <div class={`panel-body flush data-sheet ${styles.body}`}>{table}</div>
        <SideStats items={[{ label: 'Lines', value: rows.length }, { label: 'Shifts', value: shifts || DASH }, { label: 'Hours', value: dec1(hoursSum), hint: 'Each bartender’s hours, added up' }]} />
      </div>
    </section>
  );
}
