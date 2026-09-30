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
import { DASH, WEEKDAY_SHORT, clockShort, dec1, dollars, fullDate, weekdayShort, yearTag } from '../../lib/format.ts';
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
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SideStats, periodItems } from '../../ui/SideStats.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import styles from './ShiftTable.module.css';

/* The shift table: one shift, one row, each fact in its own column so any of them can be sorted or filtered.
 * Rows stay one line. Columns hug their text; spare width goes to the trailing chevron.
 *   The day is one phrase: a monospaced weekday, then the date ("Oct 3", or just "3" when the band already
 *   named the month). The weekday's width never changes, so grouping does not open a gap in the cell.
 *   A band across the head names each block once: Shift, Time, Pay, Rate, Crew. Tips, Wage and Other
 *   are the addends and sit in that order up to Total, with a thin mix bar of those same parts. Rate is
 *   tips over hours, so it is its own block after Pay, still its own column.
 *   Grouped by month or week, a band names the period once and the rows under it only say the day. The band's
 *   total sits in the Total column. Sorting reorders rows inside a period; the periods stay together.
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

/** "Main", "Main 2", or "Main 2 · Deck" — a count only when more than one person shares a station. */
function stationLabel(v: ShiftView): string {
  const n = new Map<string, number>();
  for (const c of v.crew) if (c.location) n.set(c.location, (n.get(c.location) ?? 0) + 1);
  return stationsOf(v).map(s => (n.get(s)! > 1 ? `${s} ${n.get(s)}` : s)).join(' · ');
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
      total: <span class="fig fig-key">{g.done ? dollars(g.total) : DASH}</span>,
      mix: <Mix parts={mixParts(g.views)} />
    };
  };

  const clock = (min: number | null) => (min == null ? nil : <span class="fig">{clockShort(min)}</span>);
  const kind = (name: 'sun' | 'moon' | 'star', label: string, tone: string) => (
    <span class={styles.kind} data-kind={tone}><Icon name={name} label={label} /></span>
  );

  const columns: Column<ShiftView>[] = [
    { key: 'date', group: 'Shift', head: by === 'none' ? 'Shift' : 'Day', className: 'fit', sort: v => v.shift.date + String(v.shift.start ?? 0).padStart(4, '0'),
      cell: v => <DayLine v={v} by={by} /> },
    { key: 'type', group: 'Shift', head: 'Type', className: `fit ${styles.mid}`, sort: v => v.shift.shift_type,
      cell: v => (v.shift.shift_type === 'day' ? kind('sun', 'Day', 'day') : v.shift.shift_type === 'night' ? kind('moon', 'Night', 'night') : nil) },
    { key: 'party', group: 'Shift', head: 'Party', className: `fit ${styles.mid}`, sort: v => (v.shift.party ? 1 : 0),
      cell: v => (v.shift.party ? kind('star', 'Party', 'party') : nil) },
    { key: 'start', group: 'Time', groupStart: true, head: 'Start', className: 'r fit', sort: v => v.shift.start, cell: v => clock(v.shift.start) },
    { key: 'end', group: 'Time', head: 'End', className: 'r fit', sort: v => v.shift.end, cell: v => clock(v.shift.end) },
    { key: 'hours', group: 'Time', head: 'Hours', className: 'r fit', sort: v => v.hours, cell: v => <span class="fig">{hoursFig(v.hours)}</span> },
    { key: 'tips', group: 'Pay', groupStart: true, head: 'Tips', hint: 'What the shift made', className: 'r fit', sort: v => v.shift.tips, cell: v => (done(v) ? <span class="fig fig-key">{dollars(v.shift.tips)}</span> : nil) },
    { key: 'wage', group: 'Pay', head: 'Wage', hint: 'Hours times the rate in effect that day', className: 'r fit soft', sort: v => (done(v) ? v.wage : null), cell: v => (done(v) ? (v.wage != null ? money(v.wage) : null) : nil) },
    { key: 'other', group: 'Pay', head: 'Other', hint: 'Other income logged for the shift', className: 'r fit soft', sort: v => (done(v) ? v.extra : null), cell: v => (done(v) ? (v.extra ? money(v.extra) : null) : nil) },
    { key: 'total', group: 'Pay', head: 'Total', hint: 'Tips, wage and other income added up', className: 'r fit', sort: v => (done(v) ? v.total : null), cell: v => (done(v) ? <span class="fig fig-key">{dollars(v.total)}</span> : nil) },
    { key: 'mix', group: 'Pay', head: 'Mix', hint: 'Those same parts, as shares of the total', className: `fit ${styles.mixTd}`,
      cell: v => <Mix parts={done(v) ? mixParts([v]) : []} /> },
    { key: 'rate', group: 'Rate', groupStart: true, head: 'Rate', hint: 'Tips over hours. Not part of the total.', className: 'r fit soft', sort: v => (done(v) ? v.tph : null), cell: v => (done(v) && v.tph != null ? money(v.tph) : nil) },
    { key: 'crew', group: 'Crew', groupStart: true, head: 'Who', className: `fit ${styles.crewTd}`, cell: v => <CrewCell v={v} /> },
    { key: 'count', group: 'Crew', head: 'Count', hint: 'People on the shift', className: 'r fit', sort: v => v.crewCount,
      cell: v => (v.crewCount ? <span class="fig">{v.crewCount}</span> : nil) },
    { key: 'crewHours', group: 'Crew', head: 'Hrs', hint: 'Their hours added up', className: 'r fit soft', sort: v => v.crewHours,
      cell: v => (v.crewCount ? <span class="fig">{hoursFig(v.crewHours)}</span> : nil) },
    { key: 'station', group: 'Crew', head: 'Station', hint: 'Where each person worked: Main, Deck or Upper', className: 'fit', sort: v => stationLabel(v),
      cell: v => <StationPills v={v} /> },
    { key: 'go', head: '', className: 'chev when', cell: () => <Icon name="chevron" /> }
  ];

  const sum = summarize(rows);
  const foot = {
    date: <span class={styles.footLabel}>{sum.shifts} counted</span>,
    hours: <span class="fig">{hoursFig(sum.hours)}</span>,
    tips: <span class="fig fig-key">{dollars(sum.tips)}</span>,
    wage: <span class="fig">{dollars(sum.wage)}</span>,
    other: sum.extra ? <span class="fig">{dollars(sum.extra)}</span> : nil,
    total: <span class="fig fig-key">{dollars(sum.total)}</span>,
    mix: <Mix parts={mixParts(rows)} />,
    rate: sum.tph != null ? <span class="fig">{dollars(sum.tph)}</span> : nil,
    crewHours: <span class="fig">{hoursFig(sum.crewHours)}</span>
  };

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
                foot={foot}
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
        <div class={`panel-body flush data-sheet ${styles.body} ${styles.sheet}`}>{table}</div>
        <SideStats items={periodItems(summarize(rows))} note="Rate is tips over hours. Total also includes wage and other income." />
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

/** The pay block's picture: one thin bar, each part the share it is of the total. The numbers stay in their own columns. */
function Mix({ parts }: { parts: IncomePart[] }) {
  const total = parts.reduce((t, p) => t + p.amount, 0);
  if (!total) return <span class="nil">{DASH}</span>;
  return (
    <span class={styles.mix} role="img" aria-label={parts.map(p => `${p.label} ${dollars(p.amount)}`).join(', ')}>
      {parts.map(p => <span key={p.key} style={{ width: `${(p.amount / total) * 100}%`, background: `var(${p.token})` }} />)}
    </span>
  );
}

/** The day, on one line. The weekday is monospaced and a fixed three letters wide, so "Wed" and "Fri" leave the
 *  same gap before the date. The date is one phrase — "Oct 3", or just "3" when the band already named the month —
 *  not a day number aligned in its own slot. The month stays in the reading for a screen reader either way:
 *  the band row itself is hidden from it. */
function DayLine({ v, by }: { v: ShiftView; by: GroupBy }) {
  const { month, day, weekday } = dayBadge(v.shift.date);
  const showMonth = monthInRow(v.shift.date, by);
  const year = by === 'none' ? yearTag(v.shift.date) : null;
  return (
    <span class={styles.day} title={fullDate(v.shift.date)}>
      <span class={styles.wd}>{weekday}</span>
      {!showMonth && <span class="sr-only">{month} </span>}
      {by !== 'none' && yearTag(v.shift.date) && <span class="sr-only">{v.shift.date.slice(0, 4)} </span>}
      <span class={styles.date}>{showMonth ? `${month} ${day}` : day}</span>
      {year && <span class={styles.year}>{year}</span>}
    </span>
  );
}

/** Main, Deck and Upper as small marks, in that order. A count appears only when more than one person shares a station. */
function StationPills({ v }: { v: ShiftView }) {
  const spots = stationsOf(v);
  if (!spots.length) return <span class="nil">{DASH}</span>;
  const n = new Map<string, number>();
  for (const c of v.crew) if (c.location) n.set(c.location, (n.get(c.location) ?? 0) + 1);
  return (
    <span class={styles.pills}>
      {spots.map(s => <span key={s} class={styles.pill} data-spot={s}>{n.get(s)! > 1 ? `${s} ${n.get(s)}` : s}</span>)}
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
      <span class={`avatars ${styles.crew}`}>
        {shown.map(c => <PersonAvatar key={c.id} id={c.staff_id} fallback={c.name} />)}
        {more > 0 && <span class="avatar avatar-more">+{more}</span>}
      </span>
    </HoverCard>
  );
}
