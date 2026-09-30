import { signal } from '@preact/signals';
import { hoursWorked } from '../../core/core.generated.js';
import type { Crew } from '../../core/core.generated.js';
import { oneOf, persisted } from '../../data/persisted.ts';
import { scopedViews } from '../../data/scope.ts';
import { liveStaff, liveViews, personById, ready } from '../../data/store.ts';
import { clockShort, dec1, hours, longDate } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { openSheet, sheet } from '../../router.ts';
import { OpenPill } from '../../ui/Badges.tsx';
import { DayCell } from '../../ui/DayCell.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { KpiStrip } from '../../ui/kpi.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { AddToShift } from './AddToShift.tsx';
import { CrewTimeline } from './CrewTimeline.tsx';
import styles from './Hub.module.css';

/* Crew, every shift: each bartender's time on each shift in the period, one line each. Default is a self-contained
 * row with its own date. "Group by date" hides the Date column and names the day on a band instead. A line opens
 * its shift in the drawer; "Add to a shift" opens the form's Crew page. */
interface Row { v: ShiftView; c: Crew; name: string; me: boolean }
const who = signal('');
const [groupDates, setGroupDates] = persisted('crew:group-date', oneOf(['on', 'off'] as const), 'on');

const startCell = (t: number | null) => (t == null ? '' : clockShort(t));
const endCell = (start: number | null, end: number | null) =>
  end != null ? clockShort(end) : start != null ? <OpenPill /> : '';

export function HubCrew() {
  const all = liveViews.value, views = scopedViews(all);
  const grouped = groupDates.value === 'on';
  const rows: Row[] = views.flatMap(v => v.crew
    .map(c => { const p = personById(c.staff_id); return { v, c, name: p?.name ?? c.name ?? 'Unknown', me: !!p?.is_user }; })
    .sort((a, b) => Number(b.me) - Number(a.me) || (a.c.start ?? 9999) - (b.c.start ?? 9999) || a.name.localeCompare(b.name)))
    .filter(r => !who.value || r.c.staff_id === who.value);
  const h = (r: Row) => hoursWorked(r.c.start, r.c.end);
  const hoursSum = rows.reduce((a, r) => a + (h(r) ?? 0), 0);
  const shifts = new Set(rows.map(r => r.v.shift.id)).size;

  const dateCol: Column<Row> = {
    key: 'date', head: 'Date', weight: 1.6,
    sort: r => r.v.shift.date + (r.v.shift.start ?? 0).toString().padStart(4, '0'),
    cell: r => (
      <span class="cell-lines">
        <DayCell date={r.v.shift.date} type={r.v.shift.shift_type} party={r.v.shift.party} />
        {r.c.start != null && <span class="stack-meta">{clockShort(r.c.start)}{r.c.end != null ? ` – ${clockShort(r.c.end)}` : ''}</span>}
      </span>
    )
  };
  const columns: Column<Row>[] = [
    ...(!grouped ? [dateCol] : []),
    { key: 'name', head: 'Bartender', fill: true, sort: r => r.name, cell: r => (
      <span class="who"><PersonAvatar id={r.c.staff_id} fallback={r.c.name} size="md" /><span class="who-name">{r.name}</span>{r.me && <MeBadge />}</span>
    ) },
    { key: 'start', head: 'Start', className: 'r', weight: 0.9, sort: r => r.c.start, cell: r => <span class="fig">{startCell(r.c.start)}</span> },
    { key: 'end', head: 'End', className: 'r', weight: 1.1, sort: r => r.c.end, cell: r => <span class="fig">{endCell(r.c.start, r.c.end)}</span> },
    { key: 'hours', head: 'Hours', className: 'r', weight: 0.8, sort: h, cell: r => <span class="fig">{h(r) == null ? '' : hours(h(r))}</span> },
    { key: 'station', head: 'Station', weight: 1, sort: r => r.c.location, cell: r => (r.c.location ? <span class="spot" data-spot={r.c.location}>{r.c.location}</span> : '') },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then set who worked it.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No crew hours in this period">Widen the period, or set who worked a shift with Add to a shift.</EmptyState>
    : <Table log fill paginate label="Crew hours" rows={rows} columns={columns} rowKey={r => r.c.id}
        group={grouped ? r => `${r.v.shift.date}\0${r.v.shift.id}` : undefined}
        groupLabel={grouped ? key => {
          const id = key.slice(key.indexOf('\0') + 1);
          const night = views.filter(v => v.shift.id === id);
          const v = night[0];
          if (!v) return '';
          const hrs = v.crew.reduce((a, c) => a + (hoursWorked(c.start, c.end) ?? 0), 0);
          const when = v.shift.start != null
            ? ` · ${clockShort(v.shift.start)}${v.shift.end != null ? `–${clockShort(v.shift.end)}` : ''}`
            : '';
          return (
            <div class={styles.nightBand}>
              <div class={styles.nightLabel}>{longDate(v.shift.date)}{when}</div>
              {v.crew.length > 0 && (
                <CrewTimeline compact days={[v.shift.date]} shiftsPerDay={[night]} dayHours={[hrs]} onEdit={sh => openSheet(sh.shift.id)} />
              )}
            </div>
          );
        } : undefined}
        holdGroups={grouped ? 'date' : undefined}
        onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        defaultSort={{ key: grouped ? 'name' : 'date', dir: grouped ? 'asc' : 'desc' }} />;

  return (
    <section class="panel fill" aria-labelledby="hc-title">
      <PanelHead title="All shifts" id="hc-title">
        <AddToShift views={views} page="crew" label="Set the crew of a shift" />
      </PanelHead>
      <div class={`panel-body flush list-sheet ${styles.body}`}>
        <KpiStrip label="Crew in this period" items={[
          { label: 'Lines', value: rows.length, icon: 'table' },
          { label: 'Shifts', value: shifts, icon: 'log' },
          { label: 'Hours', value: dec1(hoursSum), hint: 'Each bartender’s hours, added up', icon: 'clock', neutral: true }
        ]} />
        <div class="sheet-bar">
          <label class={styles.filter}><span class="sr-only">Bartender</span>
            <select class="input" value={who.value} onChange={e => { who.value = e.currentTarget.value; }} aria-label="Show one bartender">
              <option value="">Everyone</option>
              {liveStaff.value.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
