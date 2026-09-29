import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { hoursWorked } from '../../core/core.generated.js';
import { oneOf, persisted } from '../../data/persisted.ts';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { monthKey, weekStart } from '../../lib/dates.ts';
import { DASH, WEEKDAY_SHORT, clockShort, dec1, dollars, weekdayShort } from '../../lib/format.ts';
import { GROUP_BYS, STATUS_LABEL, dayBadge, groupShifts, shiftStatus } from '../../lib/groups.ts';
import type { GroupBy } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { CrewPhotos } from '../../parts/CrewPhotos.tsx';
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

/* The shift table: every shift in the period as one row, read the same way People and Crew are — the Log's plain list
 * look (Table `log`), not a data grid, and its first column reads like People's own `.who`: a filled, squarish date
 * mark standing in for an avatar (the type a tiny glyph riding its corner), the date ("Sep 13") as the who-name with
 * the weekday leading it as a small tag, and who-sub carrying the start→end times under it.
 *   The numbers read like a transaction list: Tips leads, `$` first (`fig-key`, the strongest figure in the row);
 * Rate reads the same way, a shade quieter (`soft`) since it's tips restated, not a new fact; Hours is quiet company
 * beside them. A rule marks off Hours·Tips·Rate as one group and Crew (the crew's faces, un-crowded) as the next;
 * nothing separates a group's own columns, and all three size the same. A shift short of its numbers reads muted.
 * Groups by month or week, like the Log (`groupBy`, remembered per device); flat is the default, since this page is
 * for looking a shift up rather than reading how the period went.
 * Search: notes, crew names and the date as written. Filter: type, weekday, party, status, who was on. */
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

const timeSpan = (v: ShiftView) => v.shift.start != null && v.shift.end != null ? `${clockShort(v.shift.start)} → ${clockShort(v.shift.end)}`
  : v.shift.start != null ? `${clockShort(v.shift.start)} →` : v.shift.end != null ? `→ ${clockShort(v.shift.end)}` : DASH;

/** An hours figure with its unit trailing, quiet (`.fig-unit`): DASH stays bare, never gains an "h". */
const hoursFig = (n: number | null) => (n == null ? DASH : <>{dec1(n)}<span class="fig-unit">h</span></>);

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

  const by = groupBy.value;
  const groupKey = (v: ShiftView) => (by === 'month' ? monthKey(v.shift.date) : by === 'week' ? weekStart(v.shift.date) : '');
  const groups = useMemo(() => (by === 'none' ? null : groupShifts(rows, by)), [rows, by]);
  const bandFor = (key: string) => {
    const g = groups?.find(x => x.key === key);
    if (!g) return null;
    return (
      <span class={styles.band}>
        <span class={styles.bandName}>{g.label}</span>
        <span class="chip num">{g.done} {g.done === 1 ? 'shift' : 'shifts'}</span>
        <span class={`fig fig-key ${styles.bandTotal}`}>{g.done ? dollars(g.total) : DASH}</span>
      </span>
    );
  };

  const columns: Column<ShiftView>[] = [
    { key: 'date', head: 'Shift', fill: true, sort: v => v.shift.date + String(v.shift.start ?? 0).padStart(4, '0'),
      cell: v => <ShiftCell v={v} /> },
    { key: 'hours', head: 'Hours', groupStart: true, weight: 0.75, className: `num soft ${styles.valCol}`, sort: v => v.hours, cell: v => <span class={`fig ${styles.valFig}`}>{hoursFig(v.hours)}</span> },
    { key: 'tips', head: 'Tips', hint: 'What the shift made', weight: 0.8, className: `num ${styles.valCol}`, sort: v => v.shift.tips, cell: v => (done(v) ? <span class={`fig fig-key ${styles.valFig}`}>{dollars(v.shift.tips)}</span> : nil) },
    { key: 'rate', head: 'Rate', hint: 'Tips over hours', weight: 0.8, className: `num soft ${styles.valCol}`, sort: v => (done(v) ? v.tph : null), cell: v => (done(v) && v.tph != null ? <span class={`fig ${styles.valFig}`}>{dollars(v.tph)}</span> : nil) },
    { key: 'income-tips', head: 'Tips', group: 'Income', groupStart: true, hint: 'What the shift made', weight: 0.8, className: `num soft ${styles.valCol}`, sort: v => (done(v) ? v.shift.tips : null), cell: v => (done(v) ? <span class={`fig ${styles.valFig}`}>{dollars(v.shift.tips)}</span> : nil) },
    { key: 'wage', head: 'Wage', group: 'Income', hint: 'Hours times the rate in effect that day', weight: 0.8, className: `num soft ${styles.valCol}`, sort: v => (done(v) ? v.wage : null), cell: v => (done(v) && v.wage != null ? <span class={`fig ${styles.valFig}`}>{dollars(v.wage)}</span> : nil) },
    { key: 'other', head: 'Other', group: 'Income', hint: 'Other income logged for the shift', weight: 0.8, className: `num soft ${styles.valCol}`, sort: v => (done(v) ? v.extra : null), cell: v => (done(v) ? <span class={`fig ${styles.valFig}`}>{dollars(v.extra)}</span> : nil) },
    { key: 'total', head: 'Total', group: 'Income', hint: 'Tips, wage and other income added up', weight: 0.9, className: `num ${styles.valCol}`, sort: v => (done(v) ? v.total : null), cell: v => (done(v) ? <span class={`fig fig-key ${styles.valFig}`}>{dollars(v.total)}</span> : nil) },
    { key: 'total-rate', head: 'Rate', group: 'Income', hint: 'Total over hours', weight: 0.8, className: `num soft ${styles.valCol}`, sort: v => (done(v) ? v.perHour : null), cell: v => (done(v) && v.perHour != null ? <span class={`fig ${styles.valFig}`}>{dollars(v.perHour)}</span> : nil) },
    { key: 'crew', head: 'Crew', groupStart: true, weight: 2, className: styles.crewTd, cell: v => <CrewCell v={v} /> },
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
            : <Table log fill separators paginate tall label="Shift table" rows={rows} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)}
                selectedId={sheet.value} tone={v => (done(v) ? undefined : 'muted')} defaultSort={{ key: 'date', dir: 'desc' }}
                group={by === 'none' ? undefined : groupKey} groupLabel={by === 'none' ? undefined : bandFor} />}
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
        <div class={`panel-body flush ${styles.body}`}>{table}</div>
        <SideStats items={periodItems(summarize(rows))} note="Rate is tips over hours. Total also includes wage and other income." />
      </div>
    </section>
  );
}

/** People's own `.who`: a filled, squarish date mark standing in for an avatar (the day number, on a month-coloured
 *  fill), the shift's type as a tiny glyph in a small circle riding its bottom-right corner, like a status dot. The
 *  date is the name ("Sep 13") with the weekday trailing it as a small mono tag and the party star after, then the
 *  start→end times under it in monospace. */
function ShiftCell({ v }: { v: ShiftView }) {
  const t = v.shift.shift_type;
  const { month, day, weekday, monthIndex } = dayBadge(v.shift.date);
  return (
    <span class="who">
      <span class={styles.dateMark} style={{ '--mc': `var(--month-${monthIndex + 1})` }}>
        {day}
        {t && <span class={styles.typeDot} data-kind={t}><Icon name={t === 'day' ? 'sun' : 'moon'} label={t === 'day' ? 'Day' : 'Night'} /></span>}
      </span>
      <span class="who-lines">
        <span class="who-top">
          <span class={styles.weekdayTag}>{weekday}</span>
          <span class="who-name">{month} {day}</span>
          {v.shift.party && <Icon name="star" label="Party" />}
        </span>
        <span class="who-sub">{timeSpan(v)}</span>
      </span>
    </span>
  );
}

const CREW_SHOWN = 6;
/** Who was on: their own photos (or a silhouette, sticker-outlined the same way), standing on the row's edge, up to
 *  six then +N. Hovering (or focusing) opens each person with their face, name and own hours — the bar's total hours
 *  already has its own column, so this doesn't repeat it. */
function CrewCell({ v }: { v: ShiftView }) {
  if (!v.crewCount) return <span class="nil">{DASH}</span>;
  const shown = v.crew.slice(0, CREW_SHOWN);
  const more = v.crewCount - shown.length;
  const card = (
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
      <span class={styles.crewCell}>
        <span class={`fig ${styles.crewHoursFig}`}>{hoursFig(v.crewHours)}</span>
        <CrewPhotos crew={shown} more={more} />
      </span>
    </HoverCard>
  );
}
