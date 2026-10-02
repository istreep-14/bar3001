import type { ComponentChildren } from 'preact';
import { rateHeat, runningMonth, shares } from '../../lib/blocks.ts';
import { weekStart } from '../../lib/dates.ts';
import { MONTH_NAMES, WEEKDAY_SHORT, dec1, hours, moneyWhole, perHourWhole, shortDate } from '../../lib/format.ts';
import { isPending } from '../../lib/groups.ts';
import { niceScale } from '../../lib/periods.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { pctChange, weeklySeries } from '../../lib/trends.ts';
import { openForm, openSheet } from '../../router.ts';
import { TableView, useTip } from '../../ui/charts.tsx';
import type { TipRow } from '../../ui/charts.tsx';
import { Icon } from '../../ui/Icon.tsx';
import type { IconName } from '../../ui/Icon.tsx';
import { DeltaPill } from '../../ui/kpi.tsx';
import { areaPath, smoothPath } from '../../ui/smooth.ts';
import s from './blocks.module.css';

/* The small widgets the blocks are built from. Each draws one thing well at block size and says it in words too
 * (aria labels, a collapsed table for the charts). Colours are tokens only: the accent for what you made, ink for the
 * comparison, hatching for what is only estimated or still to come. */

/* ── big thin figures across a page's top: a glyph, the number large, its name under it ── */
export function BigStats({ items }: { items: { label: string; value: ComponentChildren; icon: IconName; hint?: string }[] }) {
  return (
    <dl class={s.big}>
      {items.map(i => (
        <div key={i.label} title={i.hint}>
          <dd class={s.bigValue}>{i.value}</dd>
          <dt class={s.bigLabel}><Icon name={i.icon} />{i.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/* ── a whole split into pills, each as wide as its share, its name above it: dark, accent, hatched, outlined ── */
export function PillSplit({ items, fmt, label }: { items: { label: string; value: number }[]; fmt: (v: number) => string; label: string }) {
  const list = items.filter(i => i.value > 0), pct = shares(list.map(i => i.value));
  if (!list.length) return null;
  return (
    <div class={s.split} role="img" aria-label={`${label}: ${list.map((i, k) => `${i.label} ${fmt(i.value)}, ${pct[k]}%`).join('; ')}`}>
      {list.map((i, k) => (
        <div key={i.label} class={s.splitPart} style={{ flexGrow: Math.max(pct[k]!, 9) }} title={`${i.label}: ${fmt(i.value)}`}>
          <span class={s.splitName}>{i.label}</span>
          <span class={s.splitPill} data-n={k % 4}>{pct[k]}%</span>
        </div>
      ))}
    </div>
  );
}

/* ── the week as thin bars with a bead on top (hours a day), today's lit with its figure in a bubble ── */
export function WeekBars({ days, today, metric = 'hours' }: {
  days: { date: string; hours: number; tips: number; views: ShiftView[] }[]; today: string; metric?: 'hours' | 'tips';
}) {
  const val = (d: (typeof days)[number]) => (metric === 'hours' ? d.hours : d.tips);
  const max = Math.max(metric === 'hours' ? 8 : 200, ...days.map(val));
  const fmt = (n: number) => (metric === 'hours' ? `${dec1(n)}h` : moneyWhole(n));
  const lit = days.find(d => d.date === today && val(d) > 0) ?? [...days].reverse().find(d => val(d) > 0);
  return (
    <div class={s.bars} role="group" aria-label={`${metric === 'hours' ? 'Hours' : 'Tips'} each day`}>
      {days.map(d => {
        const v = val(d), first = d.views[0], future = d.date > today, on = d === lit;
        const wd = new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' });
        const pending = !!first && d.views.every(isPending);
        return (
          <button type="button" key={d.date} class={s.barCol} data-on={on ? '' : undefined} data-future={future ? '' : undefined} data-today={d.date === today ? '' : undefined}
            aria-label={`${new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' })}: ${v ? fmt(v) : pending ? 'booked' : 'no shift'}`}
            onClick={() => (first ? openSheet(first.shift.id) : openForm('new', d.date))}>
            <span class={s.barTrack}>
              {on && <span class={s.bubble} style={{ bottom: `calc(${(v / max) * 100}% + 10px)` }}>{fmt(v)}</span>}
              {v > 0 ? <span class={s.barStem} style={{ height: (v / max) * 100 + '%' }}><i /></span>
                : pending ? <span class={s.barBooked} /> : <span class={s.barNone} />}
            </span>
            <span class={s.barDay}>{wd}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── hours against a 40-hour week as a ring of ticks, the figure in the middle ── */
export function HoursRing({ worked, goal = 40, label = 'this week' }: { worked: number; goal?: number; label?: string }) {
  const N = 52, on = Math.min(N, Math.round((worked / goal) * N)), r = 44, sweep = 300, from = -150;
  return (
    <div class={s.ring} role="img" aria-label={`${hours(worked)} of ${goal} hours ${label}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {Array.from({ length: N }, (_, i) => {
          const a = ((from + (sweep / (N - 1)) * i) * Math.PI) / 180, long = i % 13 === 0;
          const r0 = long ? r - 8 : r - 5;
          return <line key={i} class={i < on ? s.tickOn : s.tick} x1={60 + Math.sin(a) * r0} y1={60 - Math.cos(a) * r0} x2={60 + Math.sin(a) * r} y2={60 - Math.cos(a) * r} />;
        })}
        <circle class={s.ringArc} cx="60" cy="60" r={r + 7} pathLength="100" style={{ strokeDasharray: `${(Math.min(worked / goal, 1) * sweep) / 3.6} 100` }}
          transform={`rotate(${from - 90} 60 60)`} />
      </svg>
      <span class={s.ringMid}><b>{dec1(worked).replace(/\.0$/, '')}<small>h</small></b><span>of {goal}h {label}</span></span>
    </div>
  );
}

/* ── a line chart for a block: smooth curves (monotone, so a running total never dips), a soft area under the main
   one, the comparison dotted, the latest point marked with its figure, every point readable on hover ── */
export interface Series { name: string; values: (number | null)[]; kind: 'main' | 'compare' }
export function LineChart({ series, labels, titles, fmt, height = 150, label }: {
  series: Series[]; labels: string[]; titles: string[]; fmt: (v: number) => string; height?: number; label: string;
}) {
  const t = useTip();
  const n = labels.length;
  const max = Math.max(0, ...series.flatMap(x => x.values.filter((v): v is number => v != null)));
  if (n < 2 || !max) return <p class={s.empty}>Not enough to draw yet.</p>;
  const scale = niceScale(max * 1.1, 3);
  const x = (i: number) => (i / (n - 1)) * 100, y = (v: number) => 100 - (v / scale.top) * 100;
  const pts = (vals: (number | null)[]) => vals.map((v, i) => (v == null ? null : { x: x(i), y: y(v) })).filter((p): p is { x: number; y: number } => !!p);
  const main = series.find(x => x.kind === 'main')!;
  const last = main.values.reduce<number>((at, v, i) => (v != null ? i : at), -1);
  const every = Math.max(1, Math.ceil(n / 4));
  return (
    <figure class={s.chart} ref={t.host} role="group" aria-label={label}>
      <div class={s.lc} style={{ '--h': height + 'px' }}>
        {scale.ticks.map(v => <i key={v} class={s.lcGrid} style={{ bottom: (v / scale.top) * 100 + '%' }} aria-hidden="true"><span>{fmt(v)}</span></i>)}
        <svg class={s.lcSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class={s.lcArea} d={areaPath(pts(main.values), 100)} />
          {series.map(x => <path key={x.name} class={x.kind === 'main' ? s.lcMain : s.lcCompare} d={smoothPath(pts(x.values))} vector-effect="non-scaling-stroke" />)}
        </svg>
        {last >= 0 && (
          <>
            <i class={s.lcGuide} style={{ left: x(last) + '%' }} aria-hidden="true" />
            <i class={s.lcDot} style={{ left: x(last) + '%', bottom: (main.values[last]! / scale.top) * 100 + '%' }} aria-hidden="true" />
            <span class={s.lcPill} style={{ left: x(last) + '%', bottom: (main.values[last]! / scale.top) * 100 + '%' }} aria-hidden="true">{fmt(main.values[last]!)}</span>
          </>
        )}
        <div class={s.lcHits}>
          {labels.map((_, i) => {
            const rows: TipRow[] = series.map(x => ({ name: x.name, value: x.values[i] == null ? '—' : fmt(x.values[i]!), cls: x.kind === 'main' ? 'k-acc' : 'k-ink' }));
            return <button type="button" key={i} class={s.lcHit} aria-label={`${titles[i]}: ${rows.map(r => `${r.name} ${r.value}`).join(', ')}`} {...t.bind(titles[i]!, rows)} />;
          })}
        </div>
      </div>
      <div class={s.lcX} aria-hidden="true">{labels.map((l, i) => <span key={i} style={{ left: x(i) + '%' }}>{i === n - 1 || (i % every === 0 && n - 1 - i >= every * 0.75) ? l : ''}</span>)}</div>
      <ul class={s.key}>
        {series.map(x => <li key={x.name}><i data-line={x.kind} />{x.name}</li>)}
      </ul>
      <TableView headers={['', ...series.map(x => x.name)]} rows={titles.map((tt, i) => [tt, ...series.map(x => (x.values[i] == null ? '—' : fmt(x.values[i]!)))])} />
      {t.node}
    </figure>
  );
}

/* ── this month's running total against last month's, by day of month ── */
export function RunningMonth({ views, today, height }: { views: ShiftView[]; today: string; height?: number }) {
  const r = runningMonth(views, today);
  const day = r.now.reduce<number>((at, v, i) => (v != null ? i : at), -1);
  const nowT = day >= 0 ? r.now[day]! : 0, then = day >= 0 ? r.prev[day]! : 0;
  const m = +r.month.slice(5) - 1, pm = +r.prevMonth.slice(5) - 1;
  return (
    <div class={s.figBlock}>
      <div class={s.figHead}>
        <span class={s.figValue}>{moneyWhole(nowT)}</span>
        <span class={s.figNote}><DeltaPill pct={pctChange(nowT, then)} /> vs {MONTH_NAMES[pm]} by day {day + 1}</span>
      </div>
      <LineChart height={height} label={`${MONTH_NAMES[m]} running total against ${MONTH_NAMES[pm]}`} fmt={moneyWhole}
        labels={Array.from({ length: r.days }, (_, i) => String(i + 1))}
        titles={Array.from({ length: r.days }, (_, i) => `${MONTH_NAMES[m]!.slice(0, 3)} ${i + 1}`)}
        series={[{ name: MONTH_NAMES[m]!, values: r.now, kind: 'main' }, { name: MONTH_NAMES[pm]!, values: r.prev, kind: 'compare' }]} />
    </div>
  );
}

/* ── tips per hour week by week, smoothed, against its own four-week average ── */
export function RateTrend({ views, today, weeks = 12, height }: { views: ShiftView[]; today: string; weeks?: number; height?: number }) {
  const series = weeklySeries(views, today, weeks);
  const lastSmooth = [...series].reverse().find(p => p.smooth != null)?.smooth ?? null;
  const before = series.length > 4 ? series[series.length - 5]!.smooth : null;
  return (
    <div class={s.figBlock}>
      <div class={s.figHead}>
        <span class={s.figValue}>{lastSmooth == null ? '—' : moneyWhole(lastSmooth)}<small>/hr</small></span>
        <span class={s.figNote}><DeltaPill pct={pctChange(lastSmooth, before)} /> 4-week average vs a month ago</span>
      </div>
      <LineChart height={height} label={`Tips per hour, last ${weeks} weeks`} fmt={moneyWhole}
        labels={series.map(p => shortDate(p.key))}
        titles={series.map(p => `Week of ${shortDate(p.key)}${p.partial ? ' (so far)' : ''}`)}
        series={[{ name: 'Each week', values: series.map(p => p.tph), kind: 'main' }, { name: '4-week average', values: series.map(p => p.smooth), kind: 'compare' }]} />
    </div>
  );
}

/* ── which nights pay: a dot per day, weekday rows by week columns, brighter the better its tips per hour; each
   weekday's average at the row's end. Drawn on the dark block. ── */
export function RateDots({ views, today, weeks = 12 }: { views: ShiftView[]; today: string; weeks?: number }) {
  const h = rateHeat(views, today, weeks);
  const avg = h.rows.map(r => summarize(r.flatMap(c => views.filter(v => v.shift.date === c.date))).tph);
  const ranked = avg.map((a, i) => ({ a, i })).filter(x => x.a != null).sort((p, q) => q.a! - p.a!);
  const best = ranked[0], worst = ranked[ranked.length - 1];
  const thisWeek = weekStart(today);
  return (
    <div class={s.dots}>
      {best && worst && best !== worst && (
        <div class={s.dotsHead}>
          <span><b>{moneyWhole(best.a!)}</b><Icon name="up" /><small>{WEEKDAY_SHORT[best.i]}</small></span>
          <span><b>{moneyWhole(worst.a!)}</b><Icon name="down" /><small>{WEEKDAY_SHORT[worst.i]}</small></span>
        </div>
      )}
      <div class={s.dotGrid} style={{ '--cols': h.weeks.length }} role="table" aria-label={`Tips per hour by weekday, last ${weeks} weeks`}>
        {h.rows.map((row, d) => (
          <div class={s.dotRow} role="row" key={d}>
            <span class={s.dotWd} role="rowheader">{WEEKDAY_SHORT[d]!.slice(0, 2)}</span>
            {row.map((c, w) => {
              const a = c.tph == null ? 0 : Math.max(0.18, c.tph / (h.max || 1));
              const tip = c.tph != null ? `${shortDate(c.date)}: ${perHourWhole(c.tph)} · ${moneyWhole(c.tips)}` : c.n ? `${shortDate(c.date)}: waiting on tips` : c.future ? `${shortDate(c.date)}: still to come` : `${shortDate(c.date)}: off`;
              return <i key={w} role="cell" class={`${s.dot} tip`} data-tip={tip} aria-label={tip}
                data-k={c.tph != null ? 'rate' : c.n ? 'booked' : c.future ? 'future' : 'off'} data-now={h.weeks[w] === thisWeek ? '' : undefined}
                style={c.tph != null ? { '--a': a.toFixed(2) } : undefined} />;
            })}
            <span class={s.dotAvg} role="cell">{avg[d] == null ? '—' : moneyWhole(avg[d]!)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
