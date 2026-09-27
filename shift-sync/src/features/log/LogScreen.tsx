import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { sheetProblems, state, syncMessage } from '../../data/sync.ts';
import { shortDate, money, moneyWhole, hours, clock, clockShort, dec1, isPastYear, weekdayShort, DASH } from '../../lib/format.ts';
import { addDays, weekStart } from '../../lib/dates.ts';
import { bandPaths } from '../../lib/table.ts';
import type { Band } from '../../lib/table.ts';
import { groupByWeek, summarize, weekEnd } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import { PartyBadge, TypeBadge } from '../../ui/Badges.tsx';
import { Cur } from '../../ui/Cur.tsx';
import { MiniStat } from '../../ui/kpi.tsx';
import { DateCell } from '../../ui/DateCell.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import { ShiftCard } from './ShiftCard.tsx';
import styles from './LogScreen.module.css';

/* Row bands: which levels are on (any combination, nested year > month > week), and which are collapsed. */
type BandId = 'year' | 'month' | 'week';
const BAND_ORDER: { id: BandId; label: string }[] = [{ id: 'year', label: 'Year' }, { id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }];
const readBands = (): BandId[] => { try { const v = JSON.parse(localStorage.getItem('bands') || 'null'); if (Array.isArray(v)) return v.filter((x): x is BandId => BAND_ORDER.some(b => b.id === x)); } catch { /* default */ } return ['week']; };
const bandsOn = signal<BandId[]>(readBands());
const collapsed = signal<ReadonlySet<string>>(new Set());
const toggleBandLevel = (id: BandId) => {
  bandsOn.value = bandsOn.value.includes(id) ? bandsOn.value.filter(b => b !== id) : [...bandsOn.value, id];
  try { localStorage.setItem('bands', JSON.stringify(bandsOn.value)); } catch { /* private mode */ }
};
const toggleBand = (path: string) => {
  const next = new Set(collapsed.value);
  if (!next.delete(path)) next.add(path);
  collapsed.value = next;
};
const long = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00').toLocaleDateString(undefined, o);
/** 'Sep 20 – 26', with the year only when no year/month band already says it. */
const weekName = (d: string, withYear: boolean) => {
  const a = weekStart(d), b = addDays(a, 6), sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return `${long(a, { month: 'short', day: 'numeric' })} – ${sameMonth ? long(b, { day: 'numeric' }) : long(b, { month: 'short', day: 'numeric' })}${withYear ? `, ${b.slice(0, 4)}` : ''}`;
};
const bandDefs = (on: BandId[]): Band<ShiftView>[] => on.length === 0 ? [] : BAND_ORDER.filter(b => on.includes(b.id)).map(({ id }): Band<ShiftView> => {
  if (id === 'year') return { id, key: v => v.shift.date.slice(0, 4), label: v => v.shift.date.slice(0, 4) };
  if (id === 'month') return { id, key: v => v.shift.date.slice(0, 7), label: v => long(v.shift.date, { month: 'long', year: on.includes('year') ? undefined : 'numeric' }) };
  return { id, key: v => weekStart(v.shift.date), label: v => weekName(v.shift.date, !on.includes('year') && !on.includes('month')) };
});

export function LogScreen() {
  const all = liveViews.value;
  const views = scopedViews(all);
  const s = summarize(views);
  const weeks = groupByWeek(views);
  const problems = sheetProblems.value;
  const selected = sheet.value;
  const showTable = isDesktop.value;   // desktop is the table; a phone gets cards
  const bands = bandDefs(bandsOn.value);
  const sum = (f: (t: ReturnType<typeof summarize>) => ComponentChildren) => (rs: ShiftView[]) => f(summarize(rs));

  /* Reads left to right as a story: when it was, what kind of shift, how long, what it made, how good that was. */
  const columns: Column<ShiftView>[] = [
    { key: 'day', head: 'Day', group: 'Shift', sort: v => new Date(v.shift.date + 'T12:00').getDay(), className: 'mute pl narrow l', cell: v => weekdayShort(v.shift.date) },
    { key: 'date', head: 'Date', group: 'Shift', sort: v => v.shift.date, className: 'strong pr l datecol', cell: (v, { banded }) => <DateCell d={v.shift.date} banded={banded} /> },
    { key: 'start', head: 'Start', group: 'Time', sort: v => v.shift.start, groupStart: true, className: 'mute pl0 r', cell: v => <span title={clock(v.shift.start)}>{clockShort(v.shift.start) ? <>{clockShort(v.shift.start)}<i class="to">–</i></> : DASH}</span> },
    { key: 'end', head: 'End', group: 'Time', sort: v => v.shift.end, className: 'mute pr0 l', cell: v => <span title={clock(v.shift.end)}>{clockShort(v.shift.end) || DASH}</span> },
    { key: 'hours', head: 'HR', hint: 'Hours worked', group: 'Time', sort: v => v.hours, derived: 'End minus Start', className: 'strong', cell: v => dec1(v.hours), summary: sum(t => dec1(t.hours)) },
    { key: 'tips', head: 'Tips', group: 'Tips', sort: v => v.shift.tips, groupStart: true, className: 'strong tight', cell: v => <Cur n={v.shift.tips} />, summary: sum(t => <Cur n={t.tips} />) },
    { key: 'rate', head: 'RATE', hint: 'Tips per hour worked (tips only)', group: 'Tips', sort: v => v.tph, className: 'mute tight', cell: v => dec1(v.tph), summary: sum(t => dec1(t.tph)) },
    { key: 'wage', head: 'Wage', hint: 'Estimated: your hours × the hourly wage in effect that day', group: 'Income', sort: v => v.wage, groupStart: true, cell: v => <Cur n={v.wage} />, summary: sum(t => <Cur n={t.wage || null} />) },
    { key: 'other', head: 'Other', hint: 'Other income', group: 'Income', sort: v => v.extra || null, cell: v => <Cur n={v.extra || null} />, summary: sum(t => <Cur n={t.extra || null} />) },
    { key: 'total', head: 'Total', group: 'Income', sort: v => v.total, derived: 'Tips + Wage + Other', className: 'strong tight', cell: v => <Cur n={v.total} />, summary: sum(t => <Cur n={t.total} />) },
    { key: 'perhr', head: 'RATE', hint: 'Everything earned per hour worked: tips, wage and other income', group: 'Income', sort: v => v.perHour, className: 'mute tight', cell: v => dec1(v.perHour), summary: sum(t => dec1(t.perHour)) },
    { key: 'crew', head: 'CT', hint: 'Bartenders on the shift', group: 'Staff', sort: v => v.crewCount || null, groupStart: true, className: 'mute narrow', cell: v => v.crewCount || DASH },
    { key: 'crewh', head: 'HR', hint: 'Hours, all bartenders added up', group: 'Staff', sort: v => v.crewHours || null, derived: 'Each bartender\'s hours added up', className: 'mute', cell: v => (v.crewHours ? dec1(v.crewHours) : DASH), summary: sum(t => dec1(t.crewHours)) },
    { key: 'type', head: 'Type', hint: 'Day or night shift', group: 'Details', sort: v => v.shift.shift_type, groupStart: true, cell: v => v.shift.shift_type ? <TypeBadge type={v.shift.shift_type} bare /> : DASH },
    { key: 'party', head: 'Party', hint: 'A party happened on this shift', group: 'Details', sort: v => (v.shift.party ? 1 : 0), cell: v => (v.shift.party ? <PartyBadge bare /> : '') },
    { key: 'notes', head: 'Notes', group: 'Details', sort: v => v.shift.notes, className: 'trunc', cell: v => v.shift.notes ?? '' }
  ];

  return (
    <section class={`panel ${styles.screen} ${showTable ? styles.fill : ''}`} aria-labelledby="log-title">
      <PanelHead title="Shift log" id="log-title">
        {showTable && (
          <div class={styles.bandbar} role="group" aria-label="Group rows by">
            <span class={styles.bandlabel}>Group by</span>
            {BAND_ORDER.map(b => (
              <button key={b.id} type="button" class="tog" aria-pressed={bandsOn.value.includes(b.id)} onClick={() => toggleBandLevel(b.id)}>{b.label}</button>
            ))}
            {bands.length > 0 && (
              <button type="button" class="btn btn-quiet" onClick={() => { collapsed.value = collapsed.value.size ? new Set() : new Set(bandPaths(views, bands).filter(p => !p.includes('/'))); }}>
                {collapsed.value.size ? 'Expand all' : 'Collapse all'}
              </button>
            )}
          </div>
        )}
        <ScopeControl />
      </PanelHead>
      <div class={`panel-body ${showTable ? 'flush' : ''} ${styles.body}`}>

      {state.value === 'failed' && (
        <div class={styles.banner} role="alert"><Icon name="alert" /><span>{syncMessage.value || 'Sync failed.'} Your shifts are saved on this device.</span></div>
      )}
      {problems.length > 0 && (
        <div class={styles.banner} role="alert">
          <Icon name="alert" />
          <div><strong>Fix these in the Sheet, then sync again:</strong><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul></div>
        </div>
      )}

      {ready.value && all.length === 0 ? (
        <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> Add shift</button>}>
          Add the date, hours and tips. Everything saves on this device first, so it works with no signal.
        </EmptyState>
      ) : ready.value && views.length === 0 ? (
        <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>
      ) : showTable ? (
        <Table fill paginate footer={<span class={styles.foot}><MiniStat label="Shifts" value={s.shifts} /><MiniStat label="Hours" value={hours(s.hours)} /><MiniStat label="Tips" value={moneyWhole(s.tips)} /><MiniStat label="Rate" value={s.tph == null ? DASH : `$${s.tph.toFixed(1)}/hr`} hint="Tips over hours worked" /><MiniStat label="Total" value={moneyWhole(s.total)} /></span>} label="Shifts" rows={views} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)} selectedId={selected}
          defaultSort={{ key: 'date', dir: 'desc' }} bands={bands} bandKey="date" collapsed={collapsed.value} onToggleBand={toggleBand} />
      ) : (
        weeks.map(w => (
          <section key={w.start} class={styles.week} aria-label={`Week of ${shortDate(w.start)}`}>
            <div class={styles.weekHead}>
              <h2 class="label">{shortDate(w.start)} – {shortDate(weekEnd(w.start))}{isPastYear(weekEnd(w.start)) && `, ${weekEnd(w.start).slice(0, 4)}`}</h2>
              <span class="num muted">{money(w.summary.total)}</span>
            </div>
            <ul class={styles.list}>{w.views.map(v => <ShiftCard key={v.shift.id} v={v} avg={s.tph} selected={selected === v.shift.id} />)}</ul>
          </section>
        ))
      )}
      </div>
    </section>
  );
}
