import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { sheetProblems, state, syncMessage } from '../../data/sync.ts';
import { shortDate, money, moneyWhole, hours, clockShort, dollars, perHour, dec1, isPastYear, weekdayShort, DASH } from '../../lib/format.ts';
import { addDays, weekStart } from '../../lib/dates.ts';
import { bandPaths } from '../../lib/table.ts';
import type { Band } from '../../lib/table.ts';
import { groupByWeek, summarize, weekEnd } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import { PartyBadge, TypeBadge } from '../../ui/Badges.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { DateCell } from '../../ui/DateCell.tsx';
import { Stack } from '../../ui/Stack.tsx';
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
  const span = (v: ShiftView) => {
    const a = clockShort(v.shift.start), b = clockShort(v.shift.end);
    return a || b ? `${a || DASH}–${b || DASH}` : DASH;
  };
  const payLines = (v: ShiftView) => {
    const more = [v.wage ? `Wage ${dollars(v.wage)}` : '', v.extra ? `Other ${dollars(v.extra)}` : ''].filter(Boolean).join(' · ');
    return [`Tips ${dollars(v.shift.tips)} · ${perHour(v.tph)}`, more];
  };

  /* Four columns, each a short stack. The drawer still has every field; the row only has to be readable. */
  const columns: Column<ShiftView>[] = [
    { key: 'date', head: 'Shift', sort: v => v.shift.date, cell: (v, { banded }) => (
      <Stack title={<DateCell d={v.shift.date} banded={banded} />} lines={[`${weekdayShort(v.shift.date)} · ${span(v)} · ${dec1(v.hours)} hr`]}
        extra={(v.shift.shift_type || v.shift.party) ? <span class="stack-row">{v.shift.shift_type ? <TypeBadge type={v.shift.shift_type} /> : null}{v.shift.party ? <PartyBadge /> : null}</span> : undefined} />
    ) },
    { key: 'total', head: 'Earned', sort: v => v.total, cell: v => <Stack title={dollars(v.total)} lines={payLines(v)} />, summary: sum(t => <Stack title={dollars(t.total)} lines={[`${dec1(t.hours)} hr · ${perHour(t.tph)}`]} />) },
    { key: 'crew', head: 'Crew', className: 'fit', sort: v => v.crewCount || null, cell: v => v.crewCount
      ? <Stack title={`${v.crewCount} ${v.crewCount === 1 ? 'person' : 'people'}`} lines={[v.crewHours ? `${dec1(v.crewHours)} hr` : DASH]} />
      : <span class="muted">{DASH}</span>, summary: sum(t => t.crewHours ? `${dec1(t.crewHours)} hr` : DASH) },
    { key: 'notes', head: 'Notes', className: 'notes', sort: v => v.shift.notes, cell: v => v.shift.notes || <span class="muted">{DASH}</span> }
  ];

  const alerts = <>
    {state.value === 'failed' && (
      <div class={styles.banner} role="alert"><Icon name="alert" /><span>{syncMessage.value || 'Sync failed.'} Your shifts are saved on this device.</span></div>
    )}
    {problems.length > 0 && (
      <div class={styles.banner} role="alert">
        <Icon name="alert" />
        <div><strong>Fix these in the Sheet, then sync again:</strong><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul></div>
      </div>
    )}
  </>;
  const empty = ready.value && all.length === 0
    ? <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> Add shift</button>}>Add the date, hours and tips. Everything saves on this device first, so it works with no signal.</EmptyState>
    : ready.value && views.length === 0
      ? <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>
      : null;

  return (
    <section class={`panel ${showTable ? 'fill' : ''}`} aria-labelledby="log-title">
      <PanelHead title="Shift log" id="log-title"><ScopeControl /></PanelHead>
      {showTable ? (
        <div class="split">
          <div class={`panel-body flush ${styles.body}`}>
            {alerts}
            {empty ?? <Table fill paginate label="Shifts" rows={views} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)} selectedId={selected}
              defaultSort={{ key: 'date', dir: 'desc' }} bands={bands} bandKey="date" collapsed={collapsed.value} onToggleBand={toggleBand} />}
          </div>
          <aside class="panel-body side" aria-label="This period">
            <div class="side-block">
              <h3 class="label">This period</h3>
              <StatList items={[
                { label: 'Shifts', value: s.shifts },
                { label: 'Hours', value: hours(s.hours) },
                { label: 'Tips', value: moneyWhole(s.tips) },
                { label: 'Rate', value: perHour(s.tph), hint: 'Tips over hours worked' },
                { label: 'Total', value: moneyWhole(s.total), hint: 'Tips, estimated wage and other income' }
              ]} />
              <p class="muted side-note">Rate is tips over hours. Total also includes wage and other income.</p>
            </div>
            <div class="side-block" role="group" aria-label="Group rows by">
              <h3 class="label">Group by</h3>
              <div class="side-togs">
                {BAND_ORDER.map(b => (
                  <button key={b.id} type="button" class="tog" aria-pressed={bandsOn.value.includes(b.id)} onClick={() => toggleBandLevel(b.id)}>{b.label}</button>
                ))}
              </div>
              {bands.length > 0 && (
                <button type="button" class="btn btn-quiet" onClick={() => { collapsed.value = collapsed.value.size ? new Set() : new Set(bandPaths(views, bands).filter(p => !p.includes('/'))); }}>
                  {collapsed.value.size ? 'Expand all' : 'Collapse all'}
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div class={`panel-body ${styles.body}`}>
          {alerts}
          {empty ?? weeks.map(w => (
            <section key={w.start} class={styles.week} aria-label={`Week of ${shortDate(w.start)}`}>
              <div class={styles.weekHead}>
                <h2 class="label">{shortDate(w.start)} – {shortDate(weekEnd(w.start))}{isPastYear(weekEnd(w.start)) && `, ${weekEnd(w.start).slice(0, 4)}`}</h2>
                <span class="num muted">{money(w.summary.total)}</span>
              </div>
              <ul class={styles.list}>{w.views.map(v => <ShiftCard key={v.shift.id} v={v} avg={s.tph} selected={selected === v.shift.id} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
