import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { LOCATIONS, hoursWorked } from '../../core/core.generated.js';
import type { Location } from '../../core/core.generated.js';
import { oneOf, persisted } from '../../data/persisted.ts';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { addDays, monthKey, weekStart } from '../../lib/dates.ts';
import { DASH, WEEKDAY_SHORT, clockTight, dec1, dollars, fullDate, perHour, weekdayShort, yearTag } from '../../lib/format.ts';
import { GROUP_BYS, STATUS_LABEL, dayBadge, groupShifts, incomeParts, shiftStatus } from '../../lib/groups.ts';
import type { GroupBy, IncomePart } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { openSheet, sheet } from '../../router.ts';
import { EmptyPeriod, EmptyState, FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import { FilterMenu } from '../../ui/FilterMenu.tsx';
import type { Facet } from '../../ui/FilterMenu.tsx';
import { HoverCard } from '../../ui/HoverCard.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { periodItems } from '../../ui/SideStats.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { Switcher } from '../../ui/Switcher.tsx';
import { SheetSearch } from '../../ui/SheetSearch.tsx';
import { TableTabs } from '../../ui/TableTabs.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import styles from './ShiftTable.module.css';

/* The shift table, Overview: a thin sheet. One column is the shift (weekday, date, a type mark, the hours it ran).
 * Hours are their own figure. Tips carry the rate under them. Crew is a short stack of faces, and a party is a
 * small star on the shift. The wide column-per-fact sheet comes back later as its own views.
 *   Grouped by month or week, a band names the period once and the rows under it only say the day.
 *   A shift short of its numbers reads muted. Search: notes, crew names and the date as written. */
const query = signal('');
const filters = signal<Filters>({});
const [groupBy, setGroupBy] = persisted<GroupBy>('table-group', oneOf(GROUP_BYS.map(g => g.id)), 'none');

const crewNames = (v: ShiftView) => v.crew.map(c => personById(c.staff_id)?.name ?? c.name).filter((n): n is string => !!n);

/** What the table can be filtered by. Values are what's stored; `labels` says how a value reads. */
const FIELDS: Record<string, { label: string; get: Field<ShiftView>; labels?: Record<string, string> }> = {
  type: { label: 'Type', get: v => v.shift.shift_type, labels: { day: 'Day', night: 'Night' } },
  weekday: { label: 'Weekday', get: v => weekdayShort(v.shift.date) },
  party: { label: 'Party', get: v => (v.shift.party ? 'yes' : 'no'), labels: { yes: 'Party', no: 'No party' } },
  status: { label: 'Status', get: shiftStatus, labels: STATUS_LABEL },
  crew: { label: 'Crew', get: crewNames },
  station: { label: 'Station', get: v => stationsOf(v) }
};

/** The stations someone on this shift logged, in Main, Deck, Upper order. */
function stationsOf(v: ShiftView): Location[] {
  const have = new Set(v.crew.map(c => c.location).filter((s): s is Location => !!s));
  return LOCATIONS.filter(s => have.has(s));
}


/** An hours figure with its unit trailing, quiet (`.fig-unit`): DASH stays bare, never gains an "h". */
const hoursFig = (n: number | null) => (n == null ? DASH : <>{dec1(n)}<span class="fig-unit">h</span></>);

/** The band already names the month, and a one-month week does too, so the row only says the day. A week that runs
 *  into the next month still names it: "2" under "Sep 28 – Oct 4" would otherwise belong to either. */
function monthInRow(date: string, by: GroupBy): boolean {
  if (by === 'none') return true;
  if (by === 'month') return false;
  const start = weekStart(date);
  return start.slice(0, 7) !== addDays(start, 6).slice(0, 7);
}

export function ShiftTable() {
  const all = liveViews.value, views = scopedViews(all);
  const q = query.value.trim().toLowerCase();
  const searched = q ? views.filter(v => [v.shift.notes, weekdayShort(v.shift.date), new Date(v.shift.date + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' }), ...crewNames(v)]
    .some(t => t?.toLowerCase().includes(q))) : views;
  const fields = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.get]));
  const filtered = applyFilters(searched, filters.value, fields);
  const rows = filtered;
  const facets: Facet[] = Object.entries(FIELDS).map(([key, f]) => ({
    key, label: f.label, options: facet(searched, f.get).map(o => ({ ...o, label: f.labels?.[o.value] }))
  }));
  // Weekdays list Monday first in the menu, not by count.
  facets.find(f => f.key === 'weekday')?.options.sort((a, b) => WEEKDAY_SHORT.indexOf(a.value) - WEEKDAY_SHORT.indexOf(b.value));

  const done = (v: ShiftView) => shiftStatus(v) === 'done';

  const by = groupBy.value;
  const groupKey = (v: ShiftView) => (by === 'month' ? monthKey(v.shift.date) : by === 'week' ? weekStart(v.shift.date) : '');
  const groups = useMemo(() => (by === 'none' ? null : groupShifts(rows, by)), [rows, by]);
  const bandCells = (key: string) => {
    const g = groups?.find(x => x.key === key);
    if (!g) return {};
    const n = g.views.length;
    const hours = g.views.reduce((t, v) => t + (shiftStatus(v) === 'done' ? (v.hours ?? 0) : 0), 0);
    return {
      shift: (
        <span class={styles.band}>
          <span class={styles.bandName}>{g.label}</span>
          <span class={styles.bandMeta}>{n} {n === 1 ? 'shift' : 'shifts'}</span>
        </span>
      ),
      hours: <span class="fig">{hoursFig(g.done ? hours : null)}</span>,
      tips: <span class="fig fig-key">{g.done ? dollars(g.tips) : DASH}</span>
    };
  };

  const columns: Column<ShiftView>[] = [
    { key: 'shift', head: by === 'none' ? 'Shift' : 'Day', className: 'fit', sort: v => v.shift.date + String(v.shift.start ?? 0).padStart(4, '0'),
      cell: v => <ShiftCell v={v} by={by} /> },
    { key: 'hours', head: 'Hours', className: 'r fit', sort: v => v.hours, cell: v => <span class="fig">{hoursFig(v.hours)}</span> },
    { key: 'tips', head: 'Tips', hint: 'What the shift made, with tips over hours under it', className: `r fit ${styles.tipsTd}`, sort: v => v.shift.tips,
      cell: v => (
        <span class={styles.money}>
          <span class="fig fig-key">{done(v) ? dollars(v.shift.tips) : DASH}</span>
          <span class={styles.rate}>{done(v) && v.tph != null ? perHour(v.tph) : DASH}</span>
        </span>
      ) },
    { key: 'crew', head: 'Crew', className: `fit ${styles.crewTd}`, sort: v => v.crewCount, cell: v => <CrewCell v={v} /> },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const sum = summarize(rows);
  const dayN = rows.filter(v => v.shift.shift_type === 'day').length;
  const nightN = rows.filter(v => v.shift.shift_type === 'night').length;
  const partyN = rows.filter(v => v.shift.party).length;
  const foot = {
    shift: <span class={styles.footLabel}>{sum.shifts} counted</span>,
    hours: <span class="fig">{hoursFig(sum.hours)}</span>,
    tips: (
      <span class={styles.money}>
        <span class="fig fig-key">{dollars(sum.tips)}</span>
        <span class={styles.rate}>{sum.tph != null ? perHour(sum.tph) : DASH}</span>
      </span>
    )
  };

  const table = ready.value && all.length === 0
    ? <FirstShiftEmpty>Add the date, hours and tips. Everything saves on this device first, so it works with no signal.</FirstShiftEmpty>
    : ready.value && views.length === 0
      ? <EmptyPeriod />
      : rows.length === 0
            ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
            : <Table log fill paginate label="Shift table" rows={rows} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)}
                selectedId={sheet.value} tone={v => (done(v) ? undefined : 'muted')} defaultSort={{ key: 'date', dir: 'desc' }}
                foot={foot}
                group={by === 'none' ? undefined : groupKey} groupCells={by === 'none' ? undefined : bandCells} holdGroups={by === 'none' ? undefined : 'shift'} />;

  // Overview is the view on the table. Search, filter, grouping and period sit on that same row, as icon buttons.
  // The period, and how the shifts split, sit in the panel to the right.
  const groupMark = by === 'month' ? 'Mo' : by === 'week' ? 'Wk' : undefined;
  const parts = mixParts(rows);
  return (
    <section class="panel fill" aria-label="Shift table">
      <div class="split">
        <div class="tabbed">
          <TableTabs label="Table view" value="overview" onChange={() => {}}
            tabs={[{ value: 'overview', label: 'Overview' }]}
            tools={<>
              <span class="sheet-count">{rows.length} of {views.length}</span>
              <SheetSearch id="shift-search" label="Search shifts" placeholder="Notes, crew, dates" value={query.value} onChange={v => { query.value = v; }} />
              <FilterMenu compact facets={facets} value={filters.value} onChange={f => { filters.value = f; }} />
              <Switcher compact label="Group" icon="cards" mark={groupMark} value={by} choices={GROUP_BYS.map(g => ({ value: g.id, label: g.id === 'none' ? 'None' : g.label }))} onChange={setGroupBy} />
              <ScopeControl compact />
            </>} />
          <div class={`data-sheet ${styles.body} ${styles.sheet} ${styles.overview}`}>{table}</div>
        </div>
        <aside class="panel-body side" aria-label="This period">
          <div class="side-block">
            <h3 class="label">This period</h3>
            <StatList items={periodItems(sum)} />
            {parts.length > 0 && <Mix parts={parts} />}
            <p class="muted side-note">Rate is tips over hours. Total also includes wage and other income.</p>
          </div>
          <div class="side-block">
            <h3 class="label">In view</h3>
            <StatList items={[{ label: 'Day', value: dayN }, { label: 'Night', value: nightN }, { label: 'Party', value: partyN }]} />
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Tips, wage and each other-income category, added across the shifts that count. Order follows the parts themselves. */
function mixParts(views: ShiftView[]): IncomePart[] {
  const acc = new Map<string, IncomePart>();
  for (const v of views) {
    if (shiftStatus(v) !== 'done') continue;
    for (const p of incomeParts(v)) {
      const cur = acc.get(p.key);
      if (cur) cur.amount += p.amount; else acc.set(p.key, { ...p });
    }
  }
  return [...acc.values()].filter(p => p.amount > 0);
}

/** Tips, wage and other income as one bar: each part the share it is of the total. */
function Mix({ parts }: { parts: IncomePart[] }) {
  const total = parts.reduce((t, p) => t + p.amount, 0);
  if (!total) return null;
  return (
    <span class={styles.mix} role="img" aria-label={parts.map(p => `${p.label} ${dollars(p.amount)}`).join(', ')}>
      {parts.map(p => <span key={p.key} style={{ width: `${(p.amount / total) * 100}%`, background: `var(${p.token})` }} />)}
    </span>
  );
}

/** The shift, in one column: weekday and date, the type as a small mark, a star when it was a party, and the
 *  hours it ran in quieter type underneath. The date drops the month when a band above already named it. */
function ShiftCell({ v, by }: { v: ShiftView; by: GroupBy }) {
  const { month, day, weekday } = dayBadge(v.shift.date);
  const showMonth = monthInRow(v.shift.date, by);
  const year = by === 'none' ? yearTag(v.shift.date) : null;
  const type = v.shift.shift_type;
  const start = clockTight(v.shift.start), end = clockTight(v.shift.end);
  const span = start || end ? `${start || '–'}–${end || '–'}` : null;
  return (
    <span class={styles.shift} title={fullDate(v.shift.date)}>
      <span class={styles.shiftTop}>
        {type === 'day' && <span class={styles.type} data-kind="day"><Icon name="sun" /></span>}
        {type === 'night' && <span class={styles.type} data-kind="night"><Icon name="moon" /></span>}
        <span class={styles.wd}>{weekday}</span>
        {!showMonth && <span class="sr-only">{month} </span>}
        {by !== 'none' && yearTag(v.shift.date) && <span class="sr-only">{v.shift.date.slice(0, 4)} </span>}
        <span class={styles.date}>{showMonth ? `${month} ${day}` : day}</span>
        {year && <span class={styles.year}>{year}</span>}
        {v.shift.party && <span class={styles.party} title="Party"><Icon name="star" /></span>}
      </span>
      {span && <span class={styles.when}>{span}</span>}
    </span>
  );
}

const CREW_SHOWN = 6;
/** Who was on, as a short stack of faces on the row's line. Hovering (or focusing) opens each person with their
 *  name and own hours — the shift's hours already have a column. */
function CrewCell({ v }: { v: ShiftView }) {
  if (!v.crewCount) return <span class="nil">{DASH}</span>;
  const shown = v.crew.slice(0, CREW_SHOWN);
  const more = v.crewCount - shown.length;
  const card = () => (
    <>
      {v.crew.map(c => {
        const p = personById(c.staff_id), h = hoursWorked(c.start, c.end);
        return (
          <span key={c.id} class={styles.who}>
            <PersonAvatar id={c.staff_id} fallback={c.name} />
            <span class={styles.whoName}>{p?.name ?? c.name ?? 'Someone'}{p?.is_user && <MeBadge />}</span>
            <span class={styles.whoSpot}>{c.location ?? ''}</span>
            <span class="fig">{h == null ? DASH : dec1(h)}</span>
          </span>
        );
      })}
      <span class={styles.whoFoot}><span>{v.crewCount} on the bar</span><b class="fig">{dec1(v.crewHours)}</b></span>
    </>
  );
  return (
    <HoverCard card={card} label={`${v.crewCount} on the bar: ${crewNames(v).join(', ')}`}>
      <span class={`avatars ${styles.crew} ${styles.crewSm}`}>
        {shown.map(c => <PersonAvatar key={c.id} id={c.staff_id} fallback={c.name} />)}
        {more > 0 && <span class="avatar avatar-more">+{more}</span>}
      </span>
    </HoverCard>
  );
}
