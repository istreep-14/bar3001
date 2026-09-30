import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { hoursWorked } from '../../core/core.generated.js';
import { oneOf, persisted } from '../../data/persisted.ts';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { addDays, monthKey, weekStart } from '../../lib/dates.ts';
import { DASH, WEEKDAY_SHORT, clockShort, dec1, dollars, fullDate, weekdayShort, yearTag } from '../../lib/format.ts';
import { GROUP_BYS, STATUS_LABEL, dayBadge, groupShifts, shiftStatus } from '../../lib/groups.ts';
import type { GroupBy } from '../../lib/groups.ts';
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
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SideStats, periodItems } from '../../ui/SideStats.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import styles from './ShiftTable.module.css';

/* The shift table: one shift, one row, each fact in its own column. Rows are a single line — a time, a rate, a wage
 * is a column, not a second line tucked under the day. Columns size to what they say and sit together; the spare
 * width of the panel goes to the trailing chevron, not into gaps between the numbers.
 *   Grouped by month or week, a band names the period once ("September 2026") and the rows under it only say the
 *   day, the way Crew names a shift once and lists the people under it. Flat, the row says the month itself.
 *   Tips is the figure that says how the shift went; Rate is tips over hours. Wage, Other and Total sit with them.
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
  crew: { label: 'Crew', get: crewNames }
};

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
  const rows = applyFilters(searched, filters.value, fields);
  const facets: Facet[] = Object.entries(FIELDS).map(([key, f]) => ({
    key, label: f.label, options: facet(searched, f.get).map(o => ({ ...o, label: f.labels?.[o.value] }))
  }));
  // Weekdays list Monday first in the menu, not by count.
  facets.find(f => f.key === 'weekday')?.options.sort((a, b) => WEEKDAY_SHORT.indexOf(a.value) - WEEKDAY_SHORT.indexOf(b.value));

  const nil = <span class="nil">{DASH}</span>;
  const done = (v: ShiftView) => shiftStatus(v) === 'done';
  const money = (n: number | null | undefined) => <span class="fig">{n == null ? DASH : dollars(n)}</span>;

  const by = groupBy.value;
  const groupKey = (v: ShiftView) => (by === 'month' ? monthKey(v.shift.date) : by === 'week' ? weekStart(v.shift.date) : '');
  const groups = useMemo(() => (by === 'none' ? null : groupShifts(rows, by)), [rows, by]);
  const bandCells = (key: string) => {
    const g = groups?.find(x => x.key === key);
    if (!g) return {};
    const n = g.views.length;
    return {
      date: (
        <span class={styles.band}>
          <span class={styles.bandName}>{g.label}</span>
          <span class={styles.bandMeta}>{n} {n === 1 ? 'shift' : 'shifts'}</span>
        </span>
      ),
      total: <span class="fig fig-key">{g.done ? dollars(g.total) : DASH}</span>
    };
  };

  const columns: Column<ShiftView>[] = [
    { key: 'date', head: by === 'none' ? 'Shift' : 'Day', className: 'fit', sort: v => v.shift.date + String(v.shift.start ?? 0).padStart(4, '0'),
      cell: v => <DayLine v={v} by={by} /> },
    { key: 'time', head: 'Time', className: 'fit soft', sort: v => v.shift.start, cell: v => <TimeCell v={v} /> },
    { key: 'hours', head: 'Hours', className: 'r fit', sort: v => v.hours, cell: v => <span class="fig">{hoursFig(v.hours)}</span> },
    { key: 'tips', head: 'Tips', groupStart: true, hint: 'What the shift made', className: 'r fit', sort: v => v.shift.tips, cell: v => (done(v) ? <span class="fig fig-key">{dollars(v.shift.tips)}</span> : nil) },
    { key: 'rate', head: 'Rate', hint: 'Tips over hours', className: 'r fit soft', sort: v => (done(v) ? v.tph : null), cell: v => (done(v) && v.tph != null ? money(v.tph) : nil) },
    { key: 'wage', head: 'Wage', hint: 'Hours times the rate in effect that day', className: 'r fit soft', sort: v => (done(v) ? v.wage : null), cell: v => (done(v) ? (v.wage != null ? money(v.wage) : null) : nil) },
    { key: 'other', head: 'Other', hint: 'Other income logged for the shift', className: 'r fit soft', sort: v => (done(v) ? v.extra : null), cell: v => (done(v) ? (v.extra ? money(v.extra) : null) : nil) },
    { key: 'total', head: 'Total', hint: 'Tips, wage and other income added up', className: 'r fit', sort: v => (done(v) ? v.total : null), cell: v => (done(v) ? <span class="fig fig-key">{dollars(v.total)}</span> : nil) },
    { key: 'crew', head: 'Crew', groupStart: true, className: `fit ${styles.crewTd}`, cell: v => <CrewCell v={v} /> },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const table = ready.value && all.length === 0
    ? <FirstShiftEmpty>Add the date, hours and tips. Everything saves on this device first, so it works with no signal.</FirstShiftEmpty>
    : ready.value && views.length === 0
      ? <EmptyPeriod />
      : <>
          <div class={styles.toolbar}>
            <input class={`input ${styles.search}`} type="search" placeholder="Search notes, crew, dates" aria-label="Search shifts"
              value={query.value} onInput={e => { query.value = e.currentTarget.value; }} />
            <FilterMenu facets={facets} value={filters.value} onChange={f => { filters.value = f; }} />
            <span class={styles.count}>{rows.length} of {views.length}</span>
          </div>
          {rows.length === 0
            ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
            : <Table log fill paginate label="Shift table" rows={rows} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)}
                selectedId={sheet.value} tone={v => (done(v) ? undefined : 'muted')} defaultSort={{ key: 'date', dir: 'desc' }}
                group={by === 'none' ? undefined : groupKey} groupCells={by === 'none' ? undefined : bandCells} holdGroups={by === 'none' ? undefined : 'date'} />}
        </>;

  const groupControl = (
    <div class="seg" role="radiogroup" aria-label="Group shifts">
      {GROUP_BYS.map(g => (
        <label key={g.id}><input type="radio" name="table-group" checked={by === g.id} onChange={() => setGroupBy(g.id)} /><span>{g.label}</span></label>
      ))}
    </div>
  );

  return (
    <section class="panel fill" aria-labelledby="table-title">
      <PanelHead title="Shift table" id="table-title">{groupControl}<ScopeControl /></PanelHead>
      <div class="split">
        <div class={`panel-body flush ${styles.body} ${styles.sheet}`}>{table}</div>
        <SideStats items={periodItems(summarize(rows))} note="Rate is tips over hours. Total also includes wage and other income." />
      </div>
    </section>
  );
}

/** Start and end sit in two fixed columns with the arrow between them, so "5:00p → 2:30a" and "10:00a → 4:00p"
 *  share one arrow down the page. A shift with only a start still shows the arrow, waiting on the end. */
function TimeCell({ v }: { v: ShiftView }) {
  const { start, end } = v.shift;
  if (start == null && end == null) return <span class="nil">{DASH}</span>;
  return (
    <span class={`fig ${styles.time}`}>
      <span class={styles.t0}>{start != null ? clockShort(start) : ''}</span>
      <span class={styles.arr} aria-hidden="true">→</span>
      <span class={styles.t1}>{end != null ? clockShort(end) : ''}</span>
    </span>
  );
}

/** The day, on one line: weekday, then the date. Flat, that is "Oct 3"; under a month band, just "3" — the band
 *  already said September. The type and a party star sit on the same line, because each is a mark, not a column.
 *  The month stays in the reading for a screen reader either way: the band row itself is hidden from it. */
function DayLine({ v, by }: { v: ShiftView; by: GroupBy }) {
  const { month, day, weekday } = dayBadge(v.shift.date);
  const showMonth = monthInRow(v.shift.date, by);
  const t = v.shift.shift_type;
  const year = by === 'none' ? yearTag(v.shift.date) : null;
  return (
    <span class={styles.day} title={fullDate(v.shift.date)}>
      <span class={styles.wd}>{weekday}</span>
      {!showMonth && <span class="sr-only">{month} </span>}
      {by !== 'none' && yearTag(v.shift.date) && <span class="sr-only">{v.shift.date.slice(0, 4)} </span>}
      <span class={styles.date}>
        {showMonth && <span class={styles.month}>{month}</span>}
        <span class={styles.dayNum}>{day}</span>
      </span>
      {year && <span class={styles.year}>{year}</span>}
      {t && <span class={styles.mark} data-kind={t}><Icon name={t === 'day' ? 'sun' : 'moon'} label={t === 'day' ? 'Day' : 'Night'} /></span>}
      {v.shift.party && <span class={styles.mark} data-kind="party"><Icon name="star" label="Party" /></span>}
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
            <span class="fig">{h == null ? DASH : dec1(h)}</span>
          </span>
        );
      })}
      <span class={styles.whoFoot}><span>{v.crewCount} on the bar</span><b class="fig">{dec1(v.crewHours)}</b></span>
    </>
  );
  return (
    <HoverCard card={card} label={`${v.crewCount} on the bar: ${crewNames(v).join(', ')}`}>
      <span class={`avatars ${styles.crew}`}>
        {shown.map(c => <PersonAvatar key={c.id} id={c.staff_id} fallback={c.name} />)}
        {more > 0 && <span class="avatar avatar-more">+{more}</span>}
      </span>
    </HoverCard>
  );
}
