import type { ComponentChildren } from 'preact';
import { addDays, today, weekStart, monthKey } from '../../../lib/dates.ts';
import { DASH, dec1, dollars, money, perHour, shortDate, weekdayShort } from '../../../lib/format.ts';
import { bandLabel, shiftStatus } from '../../../lib/groups.ts';
import { lean, scaleColor, standing } from '../../../lib/meters.ts';
import { summarize } from '../../../lib/stats.ts';
import type { ShiftView, Summary } from '../../../lib/stats.ts';
import { pctChange } from '../../../lib/trends.ts';
import { setGroupBy } from '../views.ts';
import { EmptyState } from '../../../ui/EmptyState.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { BarStrip, RankBar, SegMeter } from '../../../ui/Meters.tsx';
import type { SegCell } from '../../../ui/Meters.tsx';
import { RateFigure } from '../../../ui/RateFigure.tsx';
import { Table } from '../../../ui/Table.tsx';
import type { Column } from '../../../ui/Table.tsx';
import { DeltaPill, MiniStat } from '../../../ui/kpi.tsx';
import { TotalFigure } from '../../../ui/TotalFigure.tsx';
import { hoursFig, summedParts, wt } from '../bits.tsx';
import { bandFocus, setShiftsView, weekRollup } from '../views.ts';
import type { SheetCtx } from '../views.ts';

interface Period {
  key: string;
  name: string;
  title: string;
  views: ShiftView[];
  s: Summary;
  prev: Summary;
  hasPrev: boolean;
  running: boolean;
}

const done = (v: ShiftView) => shiftStatus(v) === 'done';

function periods(rows: ShiftView[], by: 'week' | 'month'): Period[] {
  const keyOf = (d: string) => (by === 'week' ? weekStart(d) : monthKey(d));
  const keys = [...new Set(rows.map(v => keyOf(v.shift.date)))].sort().reverse();
  const now = today();
  const cur = keyOf(now);
  return keys.map(key => {
    const views = rows.filter(v => keyOf(v.shift.date) === key);
    const running = key === cur;
    const prevKey = by === 'week' ? addDays(key, -7) : addDays(key + '-01', -1).slice(0, 7);
    let prevViews = rows.filter(v => keyOf(v.shift.date) === prevKey);
    if (running) {
      const lim = by === 'week' ? addDays(now, -7) : prevKey + now.slice(7);
      prevViews = prevViews.filter(v => v.shift.date <= lim);
    }
    const { name, title } = bandLabel(key, by);
    return { key, name, title, views, s: summarize(views), prev: summarize(prevViews), hasPrev: prevViews.some(done), running };
  });
}

export function weeksParts(ctx: SheetCtx): { table: ComponentChildren; side: ComponentChildren; summary: ComponentChildren } {
  const by = weekRollup.value;
  const { tier } = ctx;
  const narrow = tier === 'narrow';
  const list = periods(ctx.rows, by);
  const allViews = list.flatMap(r => r.views);
  const sum = summarize(allViews);
  const noun = by === 'week' ? 'week' : 'month';
  const ctxRate = { rates: list.map(r => r.s.tph).filter((n): n is number => n != null), avg: sum.tph };
  const shiftRates = allViews.filter(v => done(v) && v.tph != null).map(v => v.tph!);
  const bestTph = Math.max(0, ...shiftRates);
  const open = (r: Period) => { setGroupBy(by); bandFocus.value = r.key; setShiftsView('overview'); };

  const daysCell = (r: Period) => {
    if (by === 'month') {
      const nights = r.views.filter(v => v.shift.shift_type === 'night').length;
      return <span class="l2"><span class="fig fig-semi">{r.views.length}</span><span class="sub">{nights} night · {r.views.length - nights} day</span></span>;
    }
    const cells: SegCell[] = [];
    const words: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(r.key, i);
      const on = r.views.filter(v => v.shift.date === date);
      const v = on.find(done) ?? on[0];
      if (!v) { cells.push({}); continue; }
      const pend = !done(v);
      cells.push({
        color: pend ? undefined : v.shift.shift_type === 'night' ? 'var(--night)' : 'var(--day)',
        dashed: pend,
        ring: v.shift.party ? 'var(--party)' : undefined
      });
      words.push(`${weekdayShort(date)} ${v.shift.shift_type ?? 'shift'}${v.shift.party ? ', party' : ''}${pend ? (shiftStatus(v) === 'worked' ? ', awaiting tips' : ', upcoming') : ''}`);
    }
    const tip = words.length ? words.join(', ') : 'No shifts';
    return <span class="tip" data-tip={tip}><SegMeter tall cells={cells} /><span class="sr-only">{tip}</span></span>;
  };

  const strip = (r: Period) => {
    const d = r.views.filter(v => done(v) && v.tph != null).sort((a, b) => a.shift.date.localeCompare(b.shift.date));
    if (!d.length || !bestTph) return '';
    const best = d.reduce((a, b) => (b.tph ?? 0) > (a.tph ?? 0) ? b : a);
    const slow = d.reduce((a, b) => (b.tph ?? 0) < (a.tph ?? 0) ? b : a);
    const tip = d.length > 1
      ? `Best ${weekdayShort(best.shift.date)} ${shortDate(best.shift.date)} ${perHour(best.tph)} · slowest ${weekdayShort(slow.shift.date)} ${shortDate(slow.shift.date)} ${perHour(slow.tph)}`
      : `${weekdayShort(best.shift.date)} ${shortDate(best.shift.date)} ${perHour(best.tph)}`;
    return (
      <span class="tip" data-tip={tip}>
        <BarStrip bars={d.map(v => {
          const at = standing(shiftRates, v.tph!) ?? 0.5;
          return { h: (v.tph ?? 0) / bestTph, color: scaleColor(lean(at), 'var(--ink-4)', 80), mark: v === best && d.length > 1 ? weekdayShort(v.shift.date)[0] : undefined };
        })} />
        <span class="sr-only">{tip}</span>
      </span>
    );
  };

  let columns: Column<Period>[] = [
    { key: 'period', head: by === 'week' ? 'Week' : 'Month', weight: wt(narrow ? 8.5 : 8.75), sort: r => r.key,
      cell: r => {
        const pend = r.views.length - r.s.shifts;
        const meta = `${r.views.length} shift${r.views.length === 1 ? '' : 's'}${r.running ? ' · so far' : pend ? ` · ${pend} not counted` : ''}`;
        return <span class="l2" title={r.title}><span class="band-name">{r.name}</span>{narrow && by === 'week' ? daysCell(r) : <span class="sub">{meta}</span>}</span>;
      } },
    { key: 'days', head: by === 'week' ? '' : 'Shifts', weight: wt(6.5), sort: r => r.s.shifts,
      headCell: by === 'week' ? <span class="days-head" aria-label="Monday to Sunday">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((c, i) => <span key={i}>{c}</span>)}</span> : undefined,
      cell: daysCell },
    { key: 'hours', head: 'Hours', className: 'c', weight: wt(3.75), sort: r => r.s.hours,
      cell: r => by === 'week'
        ? <span class="l2 tip" data-tip={`${dec1(r.s.hours)}h of a 40-hour week`}>{hoursFig(r.s.hours, true)}<RankBar at={Math.min(1, r.s.hours / 40)} color="var(--ink-3)" width="3rem" soft /></span>
        : <span class="l2">{hoursFig(r.s.hours, true)}<span class="sub">avg {r.s.shifts ? dec1(r.s.hours / r.s.shifts) : '0.0'}h</span></span> },
    { key: 'tips', head: 'Tips', className: 'c hug', weight: wt(5.5), sort: r => r.s.tips,
      cell: r => {
        const p = r.hasPrev ? pctChange(r.s.tips, r.prev.tips) : null;
        return <span class="l2"><span class="fig fig-key">{dollars(r.s.tips)}</span>{p != null && <DeltaPill pct={p} />}</span>;
      } },
    { key: 'rate', head: 'Rate', className: 'c hug', weight: wt(5.75), sort: r => r.s.tph,
      cell: r => r.s.tph == null ? <span class="nil">{DASH}</span> : <RateFigure tph={r.s.tph} ctx={ctxRate} compact of={noun + 's'} /> },
    { key: 'total', head: 'Total', className: 'c', weight: wt(5.5), sort: r => r.s.total,
      cell: r => r.s.shifts ? <TotalFigure amount={r.s.total} parts={summedParts(r.views)} /> : <span class="nil">{DASH}</span> },
    { key: 'strip', head: 'Rate by shift', fill: true, minRem: 6, cell: strip },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];
  if (tier !== 'wide') columns = columns.filter(c => c.key !== 'total');
  if (narrow) columns = columns.filter(c => ['period', 'tips', 'rate', 'go'].includes(c.key));

  const ranked = list.filter(r => r.s.shifts >= 2 && r.s.tph != null).sort((a, b) => (b.s.tph ?? 0) - (a.s.tph ?? 0));
  const ends = ranked.length >= 2 ? [ranked[0]!, ranked[ranked.length - 1]!] : [];
  const n = list.length || 1;

  const table = list.length === 0
    ? <EmptyState title="No shifts in this period">Widen the period to see weeks.</EmptyState>
    : (
      <Table log fill paginate label="Shift table · Weeks" rows={list} columns={columns} rowKey={r => r.key}
        onRow={open} defaultSort={{ key: 'period', dir: 'desc' }}
        foot={{
          period: <span class="l2"><span class="foot-label">{list.length} {noun}s</span><span class="foot-sub">avg {list.length ? dec1(sum.shifts / list.length) : DASH} shifts</span></span>,
          tips: <span class="fig fig-key">{dollars(sum.tips)}</span>,
          rate: <span class="fig fig-semi">{money(sum.tph)}</span>,
          total: <TotalFigure amount={sum.total} parts={summedParts(allViews)} />
        }} />
    );

  return {
    table,
    side: (
      <>
        <div class="side-block">
          <h3 class="label">Per {noun}</h3>
          <dl class="stats">
            <div><dt>Shifts</dt><dd>{dec1(sum.shifts / n)}</dd></div>
            <div><dt>Hours</dt><dd>{dec1(sum.hours / n)}h</dd></div>
            <div><dt>Tips</dt><dd>{dollars(sum.tips / n)}</dd></div>
            <div><dt>Rate</dt><dd>{perHour(sum.tph)}</dd></div>
          </dl>
        </div>
        {ends.length > 0 && (
          <div class="side-block">
            <h3 class="label">Best and slowest {noun} by Rate</h3>
            <div class="sl">
              {ends.map(r => (
                <button key={r.key} type="button" class="sl-row" onClick={() => open(r)}>
                  <span class="band-name">{r.name}</span>
                  {r.s.tph != null && <RateFigure tph={r.s.tph} ctx={ctxRate} compact of={noun + 's'} />}
                  <span class="fig fig-q">{dollars(r.s.tips)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    ),
    summary: (
      <div class="sheet-summary">
        <MiniStat label={`Tips per ${noun}`} value={dollars(sum.tips / n)} />
        <MiniStat label="Rate" value={perHour(sum.tph)} />
      </div>
    )
  };
}
