import { signal } from '@preact/signals';
import { LOCATIONS, hoursWorked } from '../../core/core.generated.js';
import type { Crew, Location } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveStaff, liveViews, personById, ready, roleByName } from '../../data/store.ts';
import { DASH, clockPlain, clockShort, dec1 } from '../../lib/format.ts';
import { rolesOf } from '../../lib/people.ts';
import { place, placeSpan, rulerFor } from '../../lib/ruler.ts';
import type { Ruler } from '../../lib/ruler.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { DayLine } from '../../parts/DayLine.tsx';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { openSheet, sheet } from '../../router.ts';
import { avatarColor } from '../../ui/Avatar.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { RulerHead, RulerTrack } from '../../ui/Meters.tsx';
import { swatchColor } from '../../ui/swatches.ts';
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

/* Crew table: one bartender on one shift per row, one header row. The last column is the clock: the bar holds their
 * face and name on the left and the start–end on the right, and the hours sit just after the bar. A shift's lines are
 * one block. A row opens the shift. */
interface Row { v: ShiftView; c: Crew; name: string; me: boolean }
const who = signal('');
/** The quick view: every crew line, or one station's (tabs on the table). */
const station = signal<'' | Location>('');

const nil = <span class="nil">{DASH}</span>;
const span = (start: number | null, end: number | null) =>
  start == null ? '' : end == null ? `${clockShort(start)} –` : `${clockShort(start)} – ${clockShort(end)}`;
/** Date and start first, so the Shift column orders the blocks by when they were; the id keeps two shifts that start together apart. */
const byShift = (r: Row) => r.v.shift.date + String(r.v.shift.start ?? 0).padStart(4, '0') + '\0' + r.v.shift.id;
/** The bar's colour: their main role's swatch, or the colour behind their avatar. */
const barColor = (id: string) => {
  const person = personById(id);
  const main = person ? rolesOf(person).main : null;
  const role = main ? roleByName(main) : undefined;
  return swatchColor(role?.color)?.value ?? avatarColor(id, person?.avatar_color).value;
};

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
  const ruler = rulerFor(rows.map(r => ({ start: r.c.start, end: r.c.end })));

  const columns: Column<Row>[] = [
    { key: 'date', head: 'Shift', className: 'fit', weight: 1.7, once: true, sort: byShift,
      cell: r => <DayLine v={r.v} variant="line" showYear /> },
    { key: 'station', head: 'Station', className: 'fit', weight: 0.9, sort: r => r.c.location, cell: r => (
      r.c.location
        ? <span class={styles.pill} data-spot={r.c.location}>{r.c.location}</span>
        : nil
    ) },
    { key: 'span', head: '', className: 'flush', fill: true, minRem: isDesktop.value ? 16 : 11,
      headCell: <span class={styles.lane}><RulerHead ruler={ruler} compact={!isDesktop.value} /><span /></span>,
      cell: r => <CrewLane row={r} ruler={ruler} /> },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0 ? <EmptyState title="No shifts yet">Log a shift first, then set who worked it.</EmptyState>
    : rows.length === 0 ? <EmptyState title="No crew hours in this period">Widen the period, or set who worked a shift with Add to a shift.</EmptyState>
    : <Table log fill paginate label="Crew table" rows={rows} columns={columns} rowKey={r => r.c.id}
        onRow={r => openSheet(r.v.shift.id)} selected={r => r.v.shift.id === sheet.value}
        tone={r => (r.me ? 'me' : undefined)}
        group={byShift} holdGroups="date"
        foot={{
          date: <span class="foot-label">{rows.length} line{rows.length === 1 ? '' : 's'} · {shifts} shift{shifts === 1 ? '' : 's'}</span>,
          span: <span class={styles.lane}><span /><span class={styles.hrs}>{dec1(hoursSum)}<span class="fig-unit">h</span></span></span>
        }}
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
        <SideStats items={[{ label: 'Lines', value: rows.length }, { label: 'Shifts', value: shifts || DASH }, { label: 'Hours', value: dec1(hoursSum), hint: 'Each bartender’s hours, added up' }]}
          after={!isDesktop.value ? null : <MiniMonth views={views} title="Calendar" />} />
      </div>
    </section>
  );
}

/** One crew line on the shared clock: face and name on the left of the bar, start–end on the right, hours after it. */
function CrewLane({ row, ruler }: { row: Row; ruler: Ruler }) {
  const { c } = row;
  const open = c.end == null && c.start != null;
  const placed = open ? placeSpan(c.start, null, ruler) : place(c.start, c.end, ruler);
  const width = placed ? Math.min(100 - placed.left, Math.max(placed.width, open ? 8 : 0)) : 0;
  const n = hoursWorked(c.start, c.end);
  const when = span(c.start, c.end);
  const tip = c.start == null ? 'No times' : open ? `Starts ${clockPlain(c.start)}` : `${clockPlain(c.start)} to ${clockPlain(c.end)}${n != null ? `, ${dec1(n)}h` : ''}`;
  return (
    <span class={styles.lane}>
      <span class="tip" data-tip={tip}>
        <RulerTrack ruler={ruler}>
          {placed && (
            <span class={styles.bar} data-open={open ? '' : undefined} style={{ left: `${placed.left}%`, width: `${width}%`, ['--bar']: barColor(c.staff_id) }}>
              <span class={styles.who}>
                <PersonAvatar id={c.staff_id} fallback={c.name} size="sm" />
                <span class={styles.name}>{row.name}{row.me && <MeBadge />}</span>
              </span>
              {when && <span class={styles.when}>{when}</span>}
            </span>
          )}
        </RulerTrack>
        <span class="sr-only">{row.name}. {tip}</span>
      </span>
      <span class={styles.hrs}>{n == null ? nil : <>{dec1(n)}<span class="fig-unit">h</span></>}</span>
    </span>
  );
}
