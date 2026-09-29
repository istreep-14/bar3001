import { signal } from '@preact/signals';
import { hoursWorked } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { DASH, clockParts, dec1, dollars, money, weekdayShort } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import type { ShiftStatus } from '../../lib/groups.ts';
import { lean, scaleColor, standing } from '../../lib/meters.ts';
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
import { RankBar } from '../../ui/Meters.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import styles from './ShiftTable.module.css';

/* The shift table: every shift in the period as one row, for looking things up and sorting rather than reading how shifts
 * went (that's the Log). The shared table's data grid (Table `grid`): the date held in place while the rest scroll sideways,
 * small uppercase heads, hairline rows, and a totals row pinned to the bottom that adds up every done shift the search and
 * filters leave (not only this page of them). That row is the page's summary, so there's no side panel.
 *   Columns: Date (04 Sep 26, the year a weight lighter; under it the weekday and the type side by side, each led by a
 *   glyph, the type's word coloured by how the shift went, red through plain to green by where its tip rate stands) · Time & hours (start over end,
 *   colons lined up, beside a small start/end rail, then the hours) · Tips · Tip rate (a bar, a share of the best rate
 *   listed, then the figure) · Crew (faces and the bar's hours; hovering lists each person with their hours) · Status · Note.
 *   Everything is Poppins; figures use even-width digits so they line up. One-value columns read a size up from the
 *   two-line cells.
 *   Search: notes, crew names and the date as written ("Sep", "Sat"). Filter: type, weekday, party, status, who was on.
 *   Sort: any column; earlier sorts break ties. Column edges drag to resize, remembered per device.
 * A row opens the shift in the drawer. On a phone it keeps Date, Time & hours and Tips. */
const query = signal('');
const filters = signal<Filters>({});

const STATUS: Record<ShiftStatus, string> = { done: 'Done', worked: 'Awaiting tips', scheduled: 'Upcoming' };
const crewNames = (v: ShiftView) => v.crew.map(c => personById(c.staff_id)?.name ?? c.name).filter((n): n is string => !!n);

/** What the table can be filtered by. Values are what's stored; `labels` says how a value reads. */
const FIELDS: Record<string, { label: string; get: Field<ShiftView>; labels?: Record<string, string> }> = {
  type: { label: 'Type', get: v => v.shift.shift_type, labels: { day: 'Day', night: 'Night' } },
  weekday: { label: 'Weekday', get: v => weekdayShort(v.shift.date) },
  party: { label: 'Party', get: v => (v.shift.party ? 'yes' : 'no'), labels: { yes: 'Party', no: 'No party' } },
  status: { label: 'Status', get: shiftStatus, labels: STATUS },
  crew: { label: 'Crew', get: crewNames }
};

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
  facets.find(f => f.key === 'weekday')?.options.sort((a, b) => WEEK.indexOf(a.value) - WEEK.indexOf(b.value));

  const nil = <span class="nil">{DASH}</span>;
  const done = (v: ShiftView) => shiftStatus(v) === 'done';
  // What a row's rate is measured against: the done shifts listed.
  const rates = rows.filter(done).map(v => v.tph);
  const best = Math.max(0, ...rates.filter((r): r is number => r != null));
  const columns: Column<ShiftView>[] = [
    { key: 'date', head: 'Date', hint: 'The date, and under it the weekday and day or night', weight: 1.5, sort: v => v.shift.date + String(v.shift.start ?? 0).padStart(4, '0'),
      cell: v => <DateCell v={v} at={done(v) && v.tph != null ? standing(rates, v.tph) : null} /> },
    { key: 'time', head: 'Time & hours', hint: 'Sorts by start', weight: 1.5, sort: v => v.shift.start, cell: v => <TimeCell v={v} /> },
    { key: 'tips', head: 'Tips', groupStart: true, weight: 0.8, className: 'r', sort: v => v.shift.tips, cell: v => (v.shift.tips == null ? nil : <span class={`fig fig-key ${styles.one}`}>{dollars(v.shift.tips)}</span>) },
    { key: 'rate', head: 'Tip rate', hint: 'Tips per hour. The bar is a share of the best rate listed.', weight: 1.45, className: 'r', sort: v => (done(v) ? v.tph : null),
      cell: v => (done(v) && v.tph != null ? <span class={styles.rate}><span class={styles.rateBar}><RankBar at={best ? v.tph / best : 0} color="var(--accent)" /></span><span class={`fig ${styles.one} ${styles.rateFig}`}>{money(v.tph)}<span class="fig-unit">/hr</span></span></span> : nil) },
    { key: 'crew', head: 'Crew', weight: 2.6, className: styles.crewTd, sort: v => v.crewHours || null, cell: v => <CrewCell v={v} /> },
    { key: 'status', head: 'Status', weight: 1.15, sort: v => ['scheduled', 'worked', 'done'].indexOf(shiftStatus(v)), cell: v => <Status s={shiftStatus(v)} /> },
    { key: 'note', head: 'Note', weight: 1.05, className: `notes ${styles.note}`, sort: v => v.shift.notes?.toLowerCase() ?? null, cell: v => v.shift.notes || nil }
  ];
  // A phone keeps what fits, with the time given the most room.
  const PHONE: Record<string, number> = { date: 0.95, time: 1.55, tips: 0.75 };
  const shown = isDesktop.value ? columns : columns.filter(c => c.key in PHONE).map(c => ({ ...c, weight: PHONE[c.key], groupStart: false }));

  // Totals of every done shift shown (all pages), under their columns. Tip rate is tips over hours across the shifts that have both.
  const counted = rows.filter(done);
  const sum = (f: (v: ShiftView) => number | null | undefined) => counted.reduce((a, v) => a + (f(v) ?? 0), 0);
  const worked = sum(v => v.hours), tips = sum(v => v.shift.tips), bar = sum(v => v.crewHours);
  const tph = summarize(counted).tph;   // only shifts with both tips and hours, the same Rate as every other page
  const foot = {
    date: <span class={styles.footLabel}>Totals<small>{counted.length} done {counted.length === 1 ? 'shift' : 'shifts'}</small></span>,
    time: <span class={styles.tmFoot}><span class="fig fig-key">{dec1(worked)}<span class="fig-unit">h</span></span></span>,
    tips: <span class="fig fig-key">{dollars(tips)}</span>,
    rate: tph != null ? <span class="fig fig-key">{money(tph)}<span class="fig-unit">/hr</span></span> : DASH,
    crew: bar ? <span class={styles.footLabel}><span class="fig fig-key">{dec1(bar)}<span class="fig-unit">h</span></span><small>on the bar</small></span> : null
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
            : <Table grid fill paginate label="Shift table" rows={rows} columns={shown} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)}
                selectedId={sheet.value} tone={v => (done(v) ? undefined : 'muted')} defaultSort={{ key: 'date', dir: 'desc' }} foot={foot} />}
        </>;

  return (
    <section class="panel fill" aria-labelledby="table-title">
      <PanelHead title="Shift table" id="table-title"><ScopeControl /></PanelHead>
      <div class={`panel-body flush ${styles.body}`}>{table}</div>
    </section>
  );
}

/** The date as dd mmm yy (04 Sep 26, the year a weight lighter), and under it, side by side, the weekday and the shift's
 *  type, each led by a glyph the same size. The type's word takes the colour of how the shift went: where its tip rate
 *  stands among the done shifts listed (`at`, 0..1), from red through plain to green; a shift still short of its tips has
 *  no colour. A party is a star after the type. */
function DateCell({ v, at }: { v: ShiftView; at: number | null }) {
  const date = v.shift.date, t = v.shift.shift_type;
  const month = new Date(date + 'T12:00').toLocaleDateString('en-US', { month: 'short' });
  const says = at == null ? undefined : `Tip rate better than ${Math.round(at * 100)}% of the shifts here`;
  return (
    <span class={styles.day}>
      <span class={`fig ${styles.date}`}>{date.slice(8, 10)} {month} <span class={styles.yy}>{date.slice(2, 4)}</span></span>
      <span class={styles.info}>
        <span class={styles.wd}><Icon name="calendar" />{weekdayShort(date)}</span>
        {t && (
          <span class={styles.ty} data-kind={t} style={at == null ? undefined : { '--tone': scaleColor(lean(at), 'var(--ink)', 90) }} title={says}>
            <Icon name={t === 'day' ? 'sun' : 'moon'} />{t === 'day' ? 'Day' : 'Night'}
            {says && <span class="sr-only">, {says}</span>}
          </span>
        )}
        {v.shift.party && <span class={styles.party}><Icon name="star" label="Party" /></span>}
      </span>
    </span>
  );
}

/** Start over end beside a small rail (a hollow dot for the start, a solid one for the end), the hour padded so the colons
 *  line up down the column (the hour in a box of its own, right-aligned), then the hours. */
function TimeCell({ v }: { v: ShiftView }) {
  const { start, end } = v.shift;
  const time = (m: number | null, what: string) => {
    if (m == null) return <span class={styles.t} title={what}><span class="nil">{DASH}</span></span>;
    const [h, mm] = clockParts(m).hm.trim().split(':');
    return <span class={styles.t} title={what}><span class={`fig ${styles.hh}`}>{h}</span><span class="fig">:{mm}</span> <small>{clockParts(m).ap}</small></span>;
  };
  return (
    <span class={styles.tm}>
      <span class={styles.rail} aria-hidden="true"><i data-at="start" /><i data-at="end" /></span>
      {time(start, 'Start')}
      <span class={`fig fig-key ${styles.dur}`}>{v.hours == null ? <span class="nil">{DASH}</span> : <>{dec1(v.hours)}<span class="fig-unit">h</span></>}</span>
      {time(end, 'End')}
    </span>
  );
}

/** Where a shift stands, as a soft pill with a dot: green when it's done, amber while it waits on its tips, grey ahead. */
function Status({ s }: { s: ShiftStatus }) {
  return <span class={styles.status} data-s={s}><i aria-hidden="true" />{STATUS[s]}</span>;
}

const CREW_SHOWN = 6;
/** Who was on: up to six people standing in the row as one group picture (CrewPhotos) then +N, and the hours everyone worked on the bar. Hovering (or focusing) opens each person
 *  with their face, name and own hours. */
function CrewCell({ v }: { v: ShiftView }) {
  if (!v.crewCount) return <span class="nil">{DASH}</span>;
  const shown = v.crew.slice(0, CREW_SHOWN);
  const card = (
    <>
      {v.crew.map(c => {
        const p = personById(c.staff_id), h = hoursWorked(c.start, c.end);
        return (
          <span key={c.id} class={styles.who}>
            <PersonAvatar id={c.staff_id} fallback={c.name} />
            <span class={styles.whoName}>{p?.name ?? c.name ?? 'Someone'}{p?.is_user && <MeBadge />}</span>
            <span class="fig">{h == null ? DASH : `${dec1(h)}h`}</span>
          </span>
        );
      })}
      <span class={styles.whoFoot}><span>{v.crewCount} on the bar</span><b class="fig">{dec1(v.crewHours)}h</b></span>
    </>
  );
  return (
    <HoverCard card={card} label={`${v.crewCount} on the bar: ${crewNames(v).join(', ')}`}>
      <span class={styles.crew}>
        <CrewPhotos crew={shown} more={v.crewCount - shown.length} />
        {v.crewHours > 0 && <span class={`fig ${styles.crewHours}`}>{dec1(v.crewHours)}<span class="fig-unit">h</span></span>}
      </span>
    </HoverCard>
  );
}

/** The short weekday names Monday to Sunday, as this device writes them (2024-01-01 was a Monday). */
const WEEK = Array.from({ length: 7 }, (_, i) => weekdayShort(`2024-01-0${i + 1}`));
