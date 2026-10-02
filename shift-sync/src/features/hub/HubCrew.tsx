import { signal } from '@preact/signals';
import { LOCATIONS, hoursWorked } from '../../core/core.generated.js';
import type { Crew, Location } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveStaff, liveViews, personById, ready } from '../../data/store.ts';
import { DASH, clockShort, dec1, fullDate, yearTag } from '../../lib/format.ts';
import { dayBadge } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { openSheet, sheet } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SideStats } from '../../ui/SideStats.tsx';
import { Switcher } from '../../ui/Switcher.tsx';
import { TableTabs } from '../../ui/TableTabs.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { AddToShift } from './AddToShift.tsx';
import styles from './Hub.module.css';

/* Crew table: one bartender on one shift per row, same condensed sheet as the Shift table. Flat (no host grouping).
 * A line opens its shift; Add to a shift opens the form's Crew page. */
interface Row { v: ShiftView; c: Crew; name: string; me: boolean }
const who = signal('');
/** The quick view: every crew line, or one station's (tabs on the table). */
const station = signal<'' | Location>('');

const clock = (t: number | null) => (t == null ? <span class="nil">{DASH}</span> : <span class="fig">{clockShort(t)}</span>);
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

export function HubCrew() {
  const all = liveViews.value, views = scopedViews(all);
  const lines: Row[] = views.flatMap(v => v.crew
    .map(c => { const p = personById(c.staff_id); return { v, c, name: p?.name ?? c.name ?? 'Unknown', me: !!p?.is_user }; })
    .sort((a, b) => Number(b.me) - Number(a.me) || (a.c.start ?? 9999) - (b.c.start ?? 9999) || a.name.localeCompare(b.name)))
    .filter(r => !who.value || r.c.staff_id === who.value);
  const rows = lines.filter(r => !station.value || r.c.location === station.value);
  const h = (r: Row) => hoursWorked(r.c.start, r.c.end);
  const hoursSum = rows.reduce((a, r) => a + (h(r) ?? 0), 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const columns: Column<Row>[] = [
    { key: 'date', group: 'Shift', head: 'Shift', className: 'fit', sort: r => r.v.shift.date + (r.v.shift.start ?? 0).toString().padStart(4, '0'),
      cell: r => <DayLine date={r.v.shift.date} /> },
    { key: 'name', group: 'Who', groupStart: true, head: 'Bartender', sort: r => r.name, cell: r => (
      <span class={`who ${styles.crew}`}>
        <PersonAvatar id={r.c.staff_id} fallback={r.c.name} />
        <span class="who-name">{r.name}</span>
        {r.me && <MeBadge />}
      </span>
    ) },
    { key: 'start', group: 'Time', groupStart: true, head: 'Start', className: 'r fit', sort: r => r.c.start, cell: r => clock(r.c.start) },
    { key: 'end', group: 'Time', head: 'End', className: 'r fit', sort: r => r.c.end, cell: r => clock(r.c.end) },
    { key: 'hours', group: 'Time', head: 'Hours', className: 'r fit', sort: h, cell: r => { const n = h(r); return n == null ? nil : <span class="fig">{dec1(n)}<span class="fig-unit">h</span></span>; } },
    { key: 'station', group: 'Station', groupStart: true, head: 'Station', className: 'fit', sort: r => r.c.location, cell: r => (
      r.c.location
        ? <span class={styles.pill} data-spot={r.c.location}>{r.c.location}</span>
        : nil
    ) },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then set who worked it.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No crew hours in this period">Widen the period, or set who worked a shift with Add to a shift.</EmptyState>
    : <Table log fill paginate label="Crew table" rows={rows} columns={columns} rowKey={r => r.c.id}
        onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        defaultSort={{ key: 'date', dir: 'desc' }} />;

  const picked = liveStaff.value.find(p => p.id === who.value);
  const whoMark = picked ? picked.name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') : undefined;
  return (
    <section class="panel fill" aria-label="Crew table">
      <div class="split">
        <div class="tabbed">
          <TableTabs label="Which station" value={station.value} onChange={v => { station.value = v; }}
            tabs={[{ value: '' as '' | Location, label: 'All', count: lines.length }, ...LOCATIONS.map(l => ({ value: l, label: l, count: lines.filter(r => r.c.location === l).length }))]}
            tools={<>
              <Switcher compact label="Bartender" icon="users" mark={whoMark} value={who.value} onChange={v => { who.value = v; }}
                choices={[{ value: '', label: 'Everyone' }, ...liveStaff.value.map(p => ({ value: p.id, label: p.name }))]} />
              <ScopeControl compact />
              <AddToShift compact views={views} page="crew" label="Set a shift's crew" />
            </>} />
          <div class={`data-sheet ${styles.body} ${styles.sheet}`}>{table}</div>
        </div>
        <SideStats items={[{ label: 'Lines', value: rows.length }, { label: 'Shifts', value: shifts || DASH }, { label: 'Hours', value: dec1(hoursSum), hint: 'Each bartender’s hours, added up' }]} />
      </div>
    </section>
  );
}
