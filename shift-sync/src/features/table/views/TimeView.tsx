import type { ComponentChildren } from 'preact';
import { monthKey, weekStart } from '../../../lib/dates.ts';
import { DASH, clockPlain, clockTight, dec1 } from '../../../lib/format.ts';
import { groupShifts, monthInRow, shiftStatus } from '../../../lib/groups.ts';
import { place, placeSpan, rulerFor } from '../../../lib/ruler.ts';
import { summarize } from '../../../lib/stats.ts';
import type { ShiftView } from '../../../lib/stats.ts';
import { DayLine } from '../../../parts/DayLine.tsx';
import { openSheet } from '../../../router.ts';
import { EmptyState } from '../../../ui/EmptyState.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { RangeBar, RulerHead, RulerTrack, SegMeter } from '../../../ui/Meters.tsx';
import { Table } from '../../../ui/Table.tsx';
import type { Column } from '../../../ui/Table.tsx';
import { MiniStat } from '../../../ui/kpi.tsx';
import { FootCount, clockCell, endMin, hoursFig, shiftKey, wt } from '../bits.tsx';
import type { SheetCtx } from '../views.ts';

const done = (v: ShiftView) => shiftStatus(v) === 'done';
const avg = (ms: number[]) => ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length / 5) * 5 : null;

export function timeParts(ctx: SheetCtx): { table: ComponentChildren; side: ComponentChildren; summary: ComponentChildren } {
  const { rows, by, tier } = ctx;
  const narrow = tier === 'narrow';
  const grouped = by !== 'none';
  const sum = summarize(rows);
  const groups = grouped ? groupShifts(rows, by) : [];
  const spans = [
    ...rows.map(v => ({ start: v.shift.start, end: v.shift.end })),
    ...rows.flatMap(v => v.crew.map(c => ({ start: c.start, end: c.end })))
  ];
  const ruler = rulerFor(spans);
  const doneV = rows.filter(done);
  const nights = doneV.filter(v => v.shift.shift_type === 'night');
  const days = doneV.filter(v => v.shift.shift_type === 'day');
  const aStart = avg(nights.map(v => v.shift.start).filter((n): n is number => n != null));
  const aEnd = avg(nights.map(v => endMin(v.shift.start, v.shift.end)).filter((n): n is number => n != null));
  const dStart = avg(days.map(v => v.shift.start).filter((n): n is number => n != null));
  const dEnd = avg(days.map(v => endMin(v.shift.start, v.shift.end)).filter((n): n is number => n != null));

  const bar = (v: ShiftView) => {
    const color = v.shift.shift_type === 'day' ? 'var(--day)' : 'var(--night)';
    const st = shiftStatus(v);
    const placed = st === 'scheduled' ? placeSpan(v.shift.start, null, ruler) : place(v.shift.start, v.shift.end, ruler);
    const crewSpans = v.crew.map(c => place(c.start, c.end, ruler)).filter((p): p is { left: number; width: number } => !!p);
    const tip = st === 'scheduled'
      ? `Starts ${clockPlain(v.shift.start)}. Upcoming.`
      : `${clockPlain(v.shift.start)} to ${clockPlain(v.shift.end)}${v.hours != null ? `, ${dec1(v.hours)}h` : ''}`;
    return (
      <span class="tip" data-tip={tip}>
        <RulerTrack ruler={ruler}>
          {crewSpans.length > 0 && (() => {
            const left = Math.min(...crewSpans.map(p => p.left), placed?.left ?? 100);
            const right = Math.max(...crewSpans.map(p => p.left + p.width), placed ? placed.left + placed.width : 0);
            return <RangeBar left={left} width={right - left} kind="track" />;
          })()}
          {placed && <RangeBar left={placed.left} width={st === 'scheduled' ? Math.max(placed.width, 8) : placed.width} kind={st === 'scheduled' ? 'open' : st === 'worked' ? 'outline' : 'bar'} color={color} />}
        </RulerTrack>
        <span class="sr-only">{tip}</span>
      </span>
    );
  };

  let columns: Column<ShiftView>[] = [
    { key: 'shift', head: grouped ? 'Day' : 'Shift', weight: wt(narrow ? 9.5 : 12), sort: shiftKey,
      cell: v => (
        <DayLine v={v} variant={narrow ? 'stack' : 'line'} showMonth={monthInRow(v.shift.date, by)} showYear={!grouped}
          sub={narrow ? <span class="day-sub">{v.shift.end == null ? `${clockTight(v.shift.start)} start` : `${clockTight(v.shift.start)} – ${clockTight(v.shift.end)}${v.hours != null ? ` · ${dec1(v.hours)}h` : ''}`}</span> : undefined} />
      ) },
    { key: 'start', head: 'Start', className: 'c', weight: wt(3.5), sort: v => v.shift.start, cell: v => clockCell(v.shift.start) },
    { key: 'end', head: 'End', className: 'c', weight: wt(3.5), sort: v => endMin(v.shift.start, v.shift.end), cell: v => clockCell(v.shift.end) },
    { key: 'hours', head: 'Hours', className: 'c', weight: wt(2.75), sort: v => v.hours, cell: v => hoursFig(v.hours) },
    { key: 'span', head: '', className: 'flush', fill: true, minRem: narrow ? 11 : 14, headCell: <RulerHead ruler={ruler} compact={tier !== 'wide'} />, cell: bar },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];
  if (narrow) columns = columns.filter(c => ['shift', 'span', 'go'].includes(c.key));

  const bandCells = (key: string) => {
    const g = groups.find(x => x.key === key);
    if (!g) return {};
    const s = summarize(g.views);
    const d = g.views.filter(done);
    const a = avg(d.map(v => v.shift.start).filter((n): n is number => n != null));
    const e = avg(d.map(v => endMin(v.shift.start, v.shift.end)).filter((n): n is number => n != null));
    const ghost = a != null && e != null ? place(a % 1440, e >= 1440 ? e - 1440 : e, ruler) : null;
    return {
      shift: <span class="l2"><span class="band-name">{g.label}</span><span class="band-meta">{g.views.length} shifts</span></span>,
      hours: hoursFig(s.hours, true),
      span: ghost ? <RulerTrack ruler={ruler}><RangeBar left={ghost.left} width={ghost.width} kind="ghost" /></RulerTrack> : ''
    };
  };

  const over = doneV.filter(v => v.shift.end != null && v.shift.start != null && v.shift.end < v.shift.start).length;
  const longest = doneV.slice().sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))[0];
  const wk = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const on = rows.filter(v => new Date(v.shift.date + 'T12:00').getDay() === d);
    const nightsN = on.filter(v => v.shift.shift_type === 'night').length;
    const label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d];
    return { d, label, n: on.length, color: nightsN * 2 >= on.length && on.length ? 'var(--night)' : 'var(--day)' };
  });

  const table = rows.length === 0
    ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
    : (
      <Table log fill paginate label="Shift table · Time" rows={rows} columns={columns} rowKey={v => v.shift.id}
        onRow={v => openSheet(v.shift.id)} defaultSort={{ key: 'shift', dir: 'desc' }}
        foot={{ shift: <FootCount counted={sum.shifts} pending={rows.length - sum.shifts} />, hours: hoursFig(sum.hours, true), span: <RulerHead ruler={ruler} compact={tier !== 'wide'} /> }}
        tone={v => (done(v) ? undefined : 'muted')}
        group={grouped ? v => (by === 'month' ? monthKey(v.shift.date) : weekStart(v.shift.date)) : undefined}
        groupCells={grouped ? bandCells : undefined} holdGroups={grouped ? 'shift' : undefined} />
    );

  return {
    table,
    side: (
      <>
        <div class="side-block">
          <h3 class="label">Typical shift</h3>
          <dl class="stats">
            <div><dt>Nights</dt><dd>{aStart != null && aEnd != null ? `${clockPlain(aStart)} – ${clockPlain(aEnd % 1440)}` : DASH}</dd></div>
            <div><dt>Days</dt><dd>{days.length && dStart != null && dEnd != null ? `${clockPlain(dStart)} – ${clockPlain(dEnd % 1440)}` : DASH}</dd></div>
            <div><dt>Average length</dt><dd>{sum.shifts ? `${dec1(sum.hours / sum.shifts)}h` : DASH}</dd></div>
            <div><dt>Overnight</dt><dd>{over}</dd></div>
          </dl>
          {longest && (
            <button type="button" class="sl-row" onClick={() => openSheet(longest.shift.id)}>
              <span class="sub">Longest</span>
              <DayLine v={longest} variant="line" showMonth />
              {hoursFig(longest.hours, true)}
            </button>
          )}
        </div>
        <div class="side-block">
          <h3 class="label">Weekday pattern</h3>
          <div class="sl">
            {wk.map(w => (
              <div key={w.label} class="sl-row" style={{ cursor: 'default' }}>
                <span class="sub" style={{ width: '2rem' }}>{w.label}</span>
                <SegMeter n={Math.min(w.n, 6)} of={6} color={w.color} />
                <b class="fig">{w.n}</b>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
    summary: (
      <div class="sheet-summary">
        <MiniStat label="Hours" value={dec1(sum.hours) + 'h'} />
        <MiniStat label="Nights" value={aStart != null && aEnd != null ? `${clockTight(aStart)} – ${clockTight(aEnd % 1440)}` : DASH} />
      </div>
    )
  };
}
