import { signal } from '@preact/signals';
import { liveViews, ready } from '../../data/store.ts';
import { today } from '../../lib/dates.ts';
import { byRecent } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { dateCell, dec1, moneyWhole, shortDate, weekdayShort } from '../../lib/format.ts';
import { groupBy, weekdayIndex } from '../../lib/periods.ts';
import { summarize } from '../../lib/stats.ts';
import { focusWindow, histogram, hoursPerWeek, inRange, pctChange, slotInsight, weeklySeries } from '../../lib/trends.ts';
import type { Focus } from '../../lib/trends.ts';
import { ComboChart, ColumnChart, HBars, Histogram, Tiles } from '../../ui/charts.tsx';
import { DeltaPill } from '../../ui/kpi.tsx';
import { Cur } from '../../ui/Cur.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { PartyBadge, TypeBadge } from '../../ui/Badges.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import { openForm, openSheet } from '../../router.ts';
import { MiniCalendar } from './MiniCalendar.tsx';

/* Overview: what recent work is doing to your rate. Recent first: this week (or two weeks, or this month) against the
 * span just before it, the newest shift against your last few of the same weekday and type, then trends by week, where
 * hours are always a 7-day span (the 40-hour week), how your shift rates are spread, and the month and latest shifts in
 * small. Rate is tips over hours and nothing else. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FOCUS: { id: Focus; label: string }[] = [{ id: 'week', label: 'This week' }, { id: 'fortnight', label: '2 weeks' }, { id: 'month', label: 'This month' }];
const TREND: { n: number; label: string }[] = [{ n: 12, label: '12 wk' }, { n: 26, label: '26 wk' }, { n: 52, label: '52 wk' }, { n: 0, label: 'All' }];

const load = <T,>(key: string, ok: (v: unknown) => v is T, fallback: T): T => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (ok(v)) return v; } catch { /* default */ } return fallback; };
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const focus = signal<Focus>(load('ov:focus', (v): v is Focus => FOCUS.some(f => f.id === v), 'week'));
const trend = signal<number>(load('ov:trend', (v): v is number => TREND.some(t => t.n === v), 12));

const hrs = (v: number) => `${+v.toFixed(1)}h`;
const rate = (v: number | null) => (v == null ? '—' : `$${v.toFixed(1)}`);

export function OverviewScreen() {
  const all = liveViews.value;
  return (
    <section class="panel" aria-labelledby="ov-title">
      <header class="panel-head">
        <h2 id="ov-title">Overview</h2>
        <div class="panel-tools">
          <div class="seg" role="radiogroup" aria-label="Recent span">
            {FOCUS.map(f => <label key={f.id}><input type="radio" name="ov-focus" checked={focus.value === f.id} onChange={() => { focus.value = f.id; save('ov:focus', f.id); }} /><span>{f.label}</span></label>)}
          </div>
          <div class="seg" role="radiogroup" aria-label="Trend length">
            {TREND.map(t => <label key={t.n}><input type="radio" name="ov-trend" checked={trend.value === t.n} onChange={() => { trend.value = t.n; save('ov:trend', t.n); }} /><span>{t.label}</span></label>)}
          </div>
        </div>
      </header>
      <div class="panel-body">
        {ready.value && all.length === 0 ? (
          <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> New shift</button>}>
            Charts fill in as you log shifts. Everything saves on this device first, so it works with no signal.
          </EmptyState>
        ) : <Body all={all} />}
      </div>
    </section>
  );
}

function Body({ all }: { all: ShiftView[] }) {
  const now = today(), win = focusWindow(focus.value, now);
  const cur = summarize(inRange(all, win.from, win.to)), prev = summarize(inRange(all, win.prevFrom, win.prevTo));
  const perWeek = hoursPerWeek(cur.hours, win.days), prevPerWeek = hoursPerWeek(prev.hours, win.days);
  const slot = slotInsight(all);
  const last = weeklySeries(all, now, 8);   // the sparks under the tiles

  const series = weeklySeries(all, now, trend.value || null);
  const from = series[0]?.key ?? now;
  const inTrend = inRange(all, from, now);
  const done = series.filter(p => !p.partial && p.n > 0);
  const avgHours = done.length ? done.reduce((a, p) => a + p.hours, 0) / done.length : null;
  const weekTitle = (k: string, partial: boolean) => `Week of ${weekdayShort(k)}, ${shortDate(k)}${partial ? ' (so far)' : ''}`;
  const every = Math.max(1, Math.ceil(series.length / 10));
  const label = (k: string, i: number, n = every) => (i % n === 0 ? shortDate(k) : '');
  const everyNarrow = Math.max(1, Math.ceil(series.length / 4));   // the three-across charts have less room

  const histo = histogram(inTrend.filter(v => v.tph != null).map(v => v.tph!));
  const skewed = histo && histo.mean > histo.median * 1.05;
  const byDay = groupBy(inTrend, WEEKDAYS.map((l, i) => ({ key: String(i), label: l })), v => String(weekdayIndex(v.shift.date)));
  const recent = [...all].sort(byRecent).slice(0, 8);

  const columns: Column<ShiftView>[] = [
    { key: 'date', head: 'Date', className: 'strong l', cell: v => <>{weekdayShort(v.shift.date)} {dateCell(v.shift.date)}</> },
    { key: 'type', head: 'Type', className: 'hide-sm', cell: v => <>{v.shift.shift_type ? <TypeBadge type={v.shift.shift_type} bare /> : null}{v.shift.party ? <PartyBadge bare /> : null}</> },
    { key: 'hours', head: 'HR', className: 'mute', cell: v => dec1(v.hours) },
    { key: 'tips', head: 'Tips', className: 'strong', cell: v => <Cur n={v.shift.tips} /> },
    { key: 'rate', head: 'RATE', className: 'mute', cell: v => dec1(v.tph) },
    { key: 'total', head: 'Total', className: 'strong', cell: v => <Cur n={v.total} /> }
  ];

  return (
    <>
      <Tiles label={`${win.label} against ${win.prev}`} items={[
        { label: `Total income · ${win.label.toLowerCase()}`, value: moneyWhole(cur.total), lead: true, pct: pctChange(cur.total, prev.total), vs: win.prev, spark: last.map(p => p.total), hint: 'Tips + estimated wage + other income. Compared with the same days of the span before.' },
        { label: 'Tips per hour', value: rate(cur.tph), pct: pctChange(cur.tph, prev.tph), vs: win.prev, spark: last.map(p => p.tph), hint: 'Tips over hours worked, nothing else' },
        { label: 'Total per hour', value: rate(cur.perHour), pct: pctChange(cur.perHour, prev.perHour), vs: win.prev, spark: last.map(p => (p.hours ? p.total / p.hours : null)), hint: 'Everything earned over hours worked' },
        { label: win.days >= 14 ? 'Hours per week' : 'Hours', value: hrs(perWeek), neutral: true, pct: pctChange(perWeek, prevPerWeek), vs: win.prev, spark: last.map(p => p.hours), sub: <span>{cur.shifts} shift{cur.shifts === 1 ? '' : 's'}{win.days >= 14 ? ', per 7 days' : ', so far'}</span>, hint: 'Hours are shown per 7-day span so a month reads like a week' }
      ]} />

      {slot && (
        <p class="insight">
          <Icon name="trend" /><b>{slot.label}, {shortDate(slot.date)}</b> <span>{rate(slot.rate)}/hr</span>
          <DeltaPill pct={slot.pct} /><span class="muted">vs {`${slot.n === 1 ? `your previous ${slot.label}` : `your last ${slot.n} ${slot.label}s`} (${rate(slot.base)}/hr)`}</span>
        </p>
      )}

      <ComboChart title="Tips and rate by week" sub="Mon–Sun weeks; the line is tips per hour over that week and the 3 before it"
        fmtBar={moneyWhole} fmtLine={v => `$${+v.toFixed(0)}`} barLabel="Tips" lineLabel="Tips per hour" smoothLabel="Smoothed (4-week) tips per hour"
        data={series.map((p, i) => ({
          xlabel: label(p.key, i), title: weekTitle(p.key, p.partial), bar: p.tips, line: p.tph, smooth: p.smooth, partial: p.partial,
          rows: [{ name: 'tips', value: moneyWhole(p.tips) }, { name: 'per hour that week', value: rate(p.tph) }, { name: 'per hour, smoothed', value: rate(p.smooth) }, { name: `${p.n} shift${p.n === 1 ? '' : 's'}`, value: hrs(p.hours) }]
        }))} />

      <div class="chartgrid three">
        <div class="chartcard">
          <ColumnChart title="Hours per week" sub={avgHours == null ? 'against a 40-hour week' : `averaging ${hrs(avgHours)} a week`} fmt={hrs} guide={{ value: 40, label: '40h' }}
            data={series.map((p, i) => ({ xlabel: label(p.key, i, everyNarrow), title: weekTitle(p.key, p.partial), parts: [{ value: p.hours, cls: 'hrs', name: `${p.n} shift${p.n === 1 ? '' : 's'}` }] }))} />
        </div>
        <div class="chartcard">
          <Histogram title="How your rates are spread" sub="shifts per tips-per-hour bin" h={histo} fmt={v => `$${+v.toFixed(0)}`} />
          {histo && <p class="muted">{skewed ? 'The mean sits above the median: a few big shifts lift your average above a typical one.' : 'The mean and median are close: your shifts run fairly even.'}</p>}
        </div>
        <div class="chartcard">
          <HBars title="Tips per hour by weekday" sub={`over these ${series.length} weeks · number = shifts`} fmt={moneyWhole}
            data={byDay.map(g => ({ label: g.label, note: g.s.shifts ? String(g.s.shifts) : '', value: g.s.tph, cls: 'k-acc', title: g.s.shifts ? `${WEEKDAY_LONG[+g.key]}: ${moneyWhole(g.s.tips)} tips over ${hrs(g.s.hours)}` : undefined }))} />
        </div>
      </div>

      <div class="ovtwo">
        <MiniCalendar views={all} onOpen={id => openSheet(id)} />
        <figure class="viz">
          <figcaption class="viz-cap"><h4>Latest shifts</h4><a class="linkbtn" href="#/log">Open log</a></figcaption>
          <Table label="Latest shifts" rows={recent} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)} />
        </figure>
      </div>
      <p class="muted">Rate is tips over hours worked and nothing else. Wage is estimated from your hourly rate; Total per hour includes it.</p>
    </>
  );
}
