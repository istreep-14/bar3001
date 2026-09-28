import { byDate, monthGrid, rateScale } from '../../lib/calendar.ts';
import type { RateScale } from '../../lib/calendar.ts';
import { addDays, today, ymd, weekStart } from '../../lib/dates.ts';
import { dec1, dollars, hours, moneyWhole, perHour, shortDate, weekdayShort } from '../../lib/format.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { summaryRows } from '../../lib/summary.ts';
import type { SumRow } from '../../lib/summary.ts';
import { inRange, pctChange, weeklyBetween } from '../../lib/trends.ts';
import { openForm, openSheet } from '../../router.ts';
import { TypeIcon } from '../../ui/Badges.tsx';
import { ComboChart } from '../../ui/charts.tsx';
import { DeltaPill, MiniStat } from '../../ui/kpi.tsx';
import { MONTH_NAMES, RateKey } from '../../ui/MonthCalendar.tsx';
import type { Month } from '../../ui/MonthCalendar.tsx';
import { Stack } from '../../ui/Stack.tsx';
import { Table } from '../../ui/Table.tsx';
import type { Column } from '../../ui/Table.tsx';
import styles from './StackView.module.css';

/* Three months at a glance: the months stacked newest first on the left, each day shaded by its tips per hour, and beside them what
 * those months add up to: KPIs against the three months before, a month table, tips and rate by week, and the best and slowest
 * shifts by rate. Everything is the same data and numbers as the Log; only the framing differs. */
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
const monthsEnding = (end: Month, n: number): Month[] => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(end.y, end.m - i, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
const firstOf = (m: Month) => ymd(m.y, m.m, 1);
const lastOf = (m: Month) => addDays(ymd(m.y, m.m + 1, 1), -1);

export function StackView({ all, end, count = 3 }: { all: ShiftView[]; end: Month; count?: number }) {
  const months = monthsEnding(end, count);
  const from = firstOf(months[months.length - 1]!), to = lastOf(months[0]!);
  const inWin = inRange(all, from, to);
  const scale = rateScale(inWin.map(v => v.tph));
  const s = summarize(inWin);
  // the same span just before, for the change pills
  const prevEnd = { y: new Date(Date.UTC(end.y, end.m - count, 1)).getUTCFullYear(), m: new Date(Date.UTC(end.y, end.m - count, 1)).getUTCMonth() };
  const prevMonths = monthsEnding(prevEnd, count);
  const before = summarize(inRange(all, firstOf(prevMonths[prevMonths.length - 1]!), lastOf(prevMonths[0]!)));

  return (
    <div class={styles.layout}>
      <div class={styles.stack}>
        {months.map(m => <MiniMonth key={key(m.y, m.m)} month={m} all={all} scale={scale} />)}
        <RateKey scale={scale} />
      </div>
      <div class={styles.aside}>
        <div class={styles.kpis}>
          <MiniStat label="Shifts" value={s.shifts} pct={pctChange(s.shifts, before.shifts)} neutral hint={`Against the ${count} months before`} />
          <MiniStat label="Hours" value={hours(s.hours)} pct={pctChange(s.hours, before.hours)} neutral />
          <MiniStat label="Tips" value={moneyWhole(s.tips)} pct={pctChange(s.tips, before.tips)} />
          <MiniStat label="Rate" value={s.tph == null ? '—' : `$${s.tph.toFixed(1)}/hr`} pct={pctChange(s.tph, before.tph)} hint="Tips over hours worked" />
          <MiniStat label="Total" value={moneyWhole(s.total)} pct={pctChange(s.total, before.total)} />
        </div>
        <MonthTable all={all} months={months} />
        <Weekly all={all} from={from} to={to} />
        <div class={styles.lists}>
          <RankList title="Best by rate" views={inWin} dir="best" />
          <RankList title="Slowest by rate" views={inWin} dir="worst" />
        </div>
      </div>
    </div>
  );
}

function MiniMonth({ month, all, scale }: { month: Month; all: ShiftView[]; scale: RateScale | null }) {
  const now = today(), k = key(month.y, month.m);
  const cells = monthGrid(month.y, month.m), days = byDate(all);
  const inMonth = all.filter(v => v.shift.date.startsWith(k)), s = summarize(inMonth);
  return (
    <section class={styles.month} aria-label={`${MONTH_NAMES[month.m]} ${month.y}`}>
      <header class={styles.mhead}>
        <h3>{MONTH_NAMES[month.m]} <span>{month.y}</span></h3>
        <span class={styles.mstats}>{s.shifts} shift{s.shifts === 1 ? '' : 's'}{s.tph != null && <> · <b>${s.tph.toFixed(1)}</b>/hr</>}</span>
      </header>
      <div class={styles.grid}>
        {LETTERS.map((l, i) => <span key={i} class={styles.dow} aria-hidden="true">{l}</span>)}
        {cells.map(c => {
          const n = +c.date.slice(8), list = days.get(c.date) ?? [];
          if (!c.inMonth) return <span key={c.date} class={styles.out} />;
          if (list.length === 0) {
            return <button type="button" key={c.date} class={`${styles.day} ${styles.empty} ${c.date === now ? styles.today : ''}`} onClick={() => openForm('new', c.date)} title={`Log a shift on ${shortDate(c.date)}`} aria-label={`Log a shift on ${shortDate(c.date)}`}><span class={styles.n}>{n}</span></button>;
          }
          const d = summarize(list), h = scale?.at(d.tph);
          return (
            <button type="button" key={c.date} class={`${styles.day} ${styles.has} ${c.date === now ? styles.today : ''}`} data-side={h?.side} style={h ? { '--heat': String(h.mag) } : undefined}
              onClick={() => openSheet(list[0]!.shift.id)} title={`${weekdayShort(c.date)} ${shortDate(c.date)} · ${d.tph == null ? 'no rate' : '$' + d.tph.toFixed(1) + '/hr'} · ${moneyWhole(d.total)}`}
              aria-label={`Open ${shortDate(c.date)}: ${moneyWhole(d.total)}${d.tph != null ? ', $' + d.tph.toFixed(0) + ' an hour in tips' : ''}`}>
              <span class={styles.n}>{n}</span><b class={styles.rate}>{d.tph == null ? '—' : Math.round(d.tph)}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthTable({ all, months }: { all: ShiftView[]; months: Month[] }) {
  const oldest = months[months.length - 1]!;
  const before = new Date(Date.UTC(oldest.y, oldest.m - 1, 1));
  const wide = inRange(all, ymd(before.getUTCFullYear(), before.getUTCMonth(), 1), lastOf(months[0]!));
  const want = new Set(months.map(m => key(m.y, m.m)));
  const rows = summaryRows(wide, 'month').filter(r => want.has(r.key));
  const columns: Column<SumRow>[] = [
    { key: 'm', head: 'Month', cell: r => <Stack title={`${MONTH_NAMES[+r.key.slice(5) - 1]} ${r.key.slice(2, 4) === String(new Date().getFullYear()).slice(2) ? '' : '’' + r.key.slice(2, 4)}`.trim()} lines={[`${r.s.shifts} shift${r.s.shifts === 1 ? '' : 's'} · ${dec1(r.s.hours)} hr`]} /> },
    { key: 'tips', head: 'Tips', cell: r => <Stack title={dollars(r.s.tips)} lines={[perHour(r.s.tph)]} /> },
    { key: 'total', head: 'Earned', className: 'fit', cell: r => dollars(r.s.total) },
    { key: 'd', head: 'Vs previous', className: 'fit', hint: 'Tips per hour against the month before', cell: r => <DeltaPill pct={pctChange(r.s.tph, r.prev?.tph)} /> }
  ];
  return (
    <figure class="viz">
      <figcaption class="viz-cap"><h4>By month</h4></figcaption>
      <Table label="Months" rows={rows} columns={columns} rowKey={r => r.key} />
    </figure>
  );
}

function Weekly({ all, from, to }: { all: ShiftView[]; from: string; to: string }) {
  const series = weeklyBetween(all, weekStart(from), weekStart(to), today());
  const every = Math.max(1, Math.ceil(series.length / 8));
  return (
    <ComboChart title="Tips and rate by week" sub="the line is tips per hour, smoothed over 4 weeks" height={170}
      fmtBar={moneyWhole} fmtLine={v => `$${+v.toFixed(0)}`} barLabel="Tips" lineLabel="Tips per hour" smoothLabel="Smoothed tips per hour"
      data={series.map((p, i) => ({
        xlabel: i % every === 0 ? shortDate(p.key) : '', title: `Week of ${weekdayShort(p.key)}, ${shortDate(p.key)}${p.partial ? ' (so far)' : ''}`, bar: p.tips, line: p.tph, smooth: p.smooth, partial: p.partial,
        rows: [{ name: 'tips', value: moneyWhole(p.tips) }, { name: 'per hour that week', value: p.tph == null ? '—' : `$${p.tph.toFixed(1)}` }, { name: `${p.n} shift${p.n === 1 ? '' : 's'}`, value: hours(p.hours) }]
      }))} />
  );
}

function RankList({ title, views, dir }: { title: string; views: ShiftView[]; dir: 'best' | 'worst' }) {
  const list = views.filter(v => v.tph != null && (v.hours ?? 0) >= 2).sort((a, b) => (dir === 'best' ? b.tph! - a.tph! : a.tph! - b.tph!)).slice(0, 5);
  return (
    <figure class="viz">
      <figcaption class="viz-cap"><h4>{title}</h4><span class="muted">shifts of 2h or more</span></figcaption>
      {list.length === 0 ? <p class="muted">Nothing to rank yet.</p> : (
        <ol class={styles.rank}>
          {list.map(v => (
            <li key={v.shift.id}>
              <button type="button" onClick={() => openSheet(v.shift.id)}>
                <span class={styles.rdate}>{weekdayShort(v.shift.date)} {shortDate(v.shift.date)}</span>
                <TypeIcon type={v.shift.shift_type} />
                <b class={dir === 'best' ? styles.hi : styles.lo}>${v.tph!.toFixed(1)}/hr</b>
                <span class={styles.rtotal}>{moneyWhole(v.total)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
