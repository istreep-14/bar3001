import type { ComponentChildren } from 'preact';
import { monthKey, weekStart } from '../../../lib/dates.ts';
import { DASH, dollars, money, perHour } from '../../../lib/format.ts';
import { groupShifts, monthInRow, shiftStatus } from '../../../lib/groups.ts';
import { standing } from '../../../lib/meters.ts';
import { rateContext, summarize } from '../../../lib/stats.ts';
import type { RateContext, ShiftView } from '../../../lib/stats.ts';
import { CrewStack } from '../../../parts/CrewStack.tsx';
import { DayLine } from '../../../parts/DayLine.tsx';
import { openSheet } from '../../../router.ts';
import { EmptyState } from '../../../ui/EmptyState.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { ShiftStatusPill } from '../../../ui/Badges.tsx';
import { Table } from '../../../ui/Table.tsx';
import type { Column } from '../../../ui/Table.tsx';
import { MiniStat } from '../../../ui/kpi.tsx';
import { FootCount, bandOf, clockMark, endMin, hoursFig, moneyKey, shiftKey, wt } from '../bits.tsx';
import { ShiftSide } from '../ShiftSide.tsx';
import { bandFocus } from '../views.ts';
import type { SheetCtx } from '../views.ts';

const done = (v: ShiftView) => shiftStatus(v) === 'done';

/** Where this rate stands, in words. The figure itself is the same money() the other sheets use. */
const rateSays = (tph: number, ctx: RateContext) => {
  const at = standing(ctx.rates, tph);
  const diff = ctx.avg == null ? null : tph - ctx.avg;
  if (at == null || diff == null || ctx.avg == null) return undefined;
  const vs = Math.abs(diff) < 0.005 ? 'Right on' : `${perHour(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'}`;
  return `Better than ${Math.round(at * 100)}% of the shifts here\n${vs} your average ${perHour(ctx.avg)}`;
};

const rateFig = (tph: number | null | undefined, says?: string) => {
  if (tph == null) return <span class="nil">{DASH}</span>;
  return <span class={`fig${says ? ' tip' : ''}`} data-tip={says}>{money(tph)}{says && <span class="sr-only">. {says.replace('\n', '. ')}</span>}</span>;
};

export function overviewParts(ctx: SheetCtx): { table: ComponentChildren; side: ComponentChildren; summary: ComponentChildren } {
  const focus = bandFocus.value;
  const focused = focus ? ctx.rows.filter(v => (ctx.by === 'month' ? monthKey(v.shift.date) : weekStart(v.shift.date)) === focus) : [];
  const rows = focused.length ? focused : ctx.rows;
  const { by, tier, rem } = ctx;
  const narrow = tier === 'narrow';
  const showCrew = !narrow || (rem != null && rem >= 26);
  const grouped = by !== 'none';
  const sum = summarize(rows);
  const pending = rows.length - sum.shifts;
  const ctxRate = rateContext(rows.filter(done));
  const groups = grouped ? groupShifts(rows, by) : [];

  const tipsCell = (v: ShiftView) => {
    if (!done(v)) return narrow ? '' : <ShiftStatusPill status={shiftStatus(v)} />;
    if (v.shift.tips == null) return <span class="nil">{DASH}</span>;
    if (!narrow) return moneyKey(v.shift.tips);
    const says = v.tph == null ? undefined : rateSays(v.tph, ctxRate);
    return (
      <span class="l2">
        {moneyKey(v.shift.tips)}
        {v.tph != null && <span class={`sub${says ? ' tip' : ''}`} data-tip={says}>{money(v.tph)}{says && <span class="sr-only">. {says.replace('\n', '. ')}</span>}</span>}
      </span>
    );
  };

  const columns: Column<ShiftView>[] = [
    { key: 'shift', head: grouped ? 'Day' : 'Shift', weight: wt(narrow ? 9.5 : 12), sort: shiftKey,
      cell: v => (
        <DayLine v={v} showMonth={monthInRow(v.shift.date, by)} showYear={by === 'none'} tight={narrow} clock={narrow}
          sub={narrow && !done(v) ? <span class="day-sub"><ShiftStatusPill status={shiftStatus(v)} compact /></span> : undefined} />
      ) },
    ...(!narrow ? [
      { key: 'start', head: 'Start', className: 'c', weight: wt(3.5), sort: (v: ShiftView) => v.shift.start, cell: (v: ShiftView) => clockMark(v.shift.start) },
      { key: 'end', head: 'End', className: 'c', weight: wt(3.5), sort: (v: ShiftView) => endMin(v.shift.start, v.shift.end), cell: (v: ShiftView) => clockMark(v.shift.end) },
      { key: 'hours', head: 'Hours', className: 'c', weight: wt(2.75), sort: (v: ShiftView) => v.hours,
        cell: (v: ShiftView) => shiftStatus(v) === 'scheduled' ? <span class="nil">{DASH}</span> : hoursFig(v.hours) },
    ] satisfies Column<ShiftView>[] : []),
    { key: 'tips', head: 'Tips', className: 'c', weight: wt(narrow ? 5.5 : 6.75), sort: v => done(v) ? v.shift.tips : null, cell: tipsCell },
    ...(!narrow ? [
      { key: 'rate', head: 'Rate', className: 'c', weight: wt(4.6), hint: 'Tips per hour. The only figure shifts are ranked by.',
        sort: (v: ShiftView) => v.tph,
        cell: (v: ShiftView) => !done(v) ? '' : rateFig(v.tph, v.tph == null ? undefined : rateSays(v.tph, ctxRate)) },
    ] satisfies Column<ShiftView>[] : []),
    ...(showCrew ? [{ key: 'crew', head: 'Crew', className: 'lead', fill: true, minRem: narrow ? 5.5 : 7.5, sort: (v: ShiftView) => v.crewCount,
      cell: (v: ShiftView) => <CrewStack crew={v.crew} max={narrow ? 3 : 5} sm={narrow} crewHours={v.crewHours} /> } satisfies Column<ShiftView>] : []),
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];

  const bandCells = (key: string) => {
    const g = groups.find(x => x.key === key);
    if (!g) return {};
    const s = summarize(g.views);
    const rateTip = `Tips over hours across this ${by}'s ${s.shifts} done shift${s.shifts === 1 ? '' : 's'}`;
    return {
      shift: bandOf(key, by, g),
      hours: hoursFig(g.done ? s.hours : null, true),
      tips: moneyKey(g.done ? s.tips : null),
      rate: rateFig(s.tph, rateTip)
    };
  };

  const foot = {
    shift: <FootCount counted={sum.shifts} pending={pending} />,
    hours: hoursFig(sum.hours, true),
    tips: narrow
      ? <span class="l2">{moneyKey(sum.tips)}{sum.tph != null && <span class="sub">{money(sum.tph)}</span>}</span>
      : moneyKey(sum.tips),
    rate: rateFig(sum.tph, `Tips over hours across the ${sum.shifts} counted shifts.`)
  };

  const table = rows.length === 0
    ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
    : (
      <Table log fill paginate label="Shift table · Overview" rows={rows} columns={columns} rowKey={v => v.shift.id}
        onRow={v => openSheet(v.shift.id)} defaultSort={{ key: 'shift', dir: 'desc' }} foot={foot}
        tone={v => (done(v) ? undefined : 'muted')}
        group={grouped ? v => (by === 'month' ? monthKey(v.shift.date) : weekStart(v.shift.date)) : undefined}
        groupCells={grouped ? bandCells : undefined} holdGroups={grouped ? 'shift' : undefined} />
    );

  const summary = (
    <div class="sheet-summary">
      <MiniStat label="Rate" value={perHour(sum.tph)} />
      <MiniStat label="Tips" value={dollars(sum.tips)} />
    </div>
  );
  return { table, side: <ShiftSide rows={rows} />, summary };
}
