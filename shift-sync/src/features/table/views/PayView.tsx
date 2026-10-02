import type { ComponentChildren } from 'preact';
import { CATEGORIES } from '../../../core/core.generated.js';
import { monthKey, weekStart } from '../../../lib/dates.ts';
import { dec1, dollars, money, shortDate } from '../../../lib/format.ts';
import { groupShifts, monthInRow, shiftStatus } from '../../../lib/groups.ts';
import { lean, scaleColor, standing } from '../../../lib/meters.ts';
import { summarize } from '../../../lib/stats.ts';
import type { ShiftView } from '../../../lib/stats.ts';
import { DayLine } from '../../../parts/DayLine.tsx';
import { openSheet } from '../../../router.ts';
import { EmptyState } from '../../../ui/EmptyState.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { RankBar } from '../../../ui/Meters.tsx';
import { Table } from '../../../ui/Table.tsx';
import type { Column } from '../../../ui/Table.tsx';
import { MiniStat } from '../../../ui/kpi.tsx';
import { TotalFigure } from '../../../ui/TotalFigure.tsx';
import { FootCount, bandOf, moneyMed, moneyOrStatus, rowParts, shiftKey, summedParts, wt } from '../bits.tsx';
import { PaySide } from '../ShiftSide.tsx';
import type { SheetCtx } from '../views.ts';

const done = (v: ShiftView) => shiftStatus(v) === 'done';

const sourcesOf = (v: ShiftView): string[] => {
  const names: string[] = CATEGORIES.filter(c => v.income.some(i => i.category === c));
  if (v.shift.other) names.push('Earlier entry');
  return names;
};

export function payParts(ctx: SheetCtx): { table: ComponentChildren; side: ComponentChildren; summary: ComponentChildren } {
  const { rows, by, tier } = ctx;
  const narrow = tier === 'narrow';
  const grouped = by !== 'none';
  const sum = summarize(rows);
  const groups = grouped ? groupShifts(rows, by) : [];
  const rates = rows.filter(done).map(v => v.perHour).filter((n): n is number => n != null);
  const mark = sum.perHour == null ? null : standing(rates, sum.perHour);
  const cap = tier === 'wide' ? 6 : 2;

  const otherCell = (v: ShiftView) => {
    if (!done(v) || !v.extra) return '';
    const all = sourcesOf(v);
    const shown = all.slice(0, cap);
    const more = all.length - shown.length;
    const tip = [
      ...v.income.map(i => `${i.category} ${money(i.amount)}${i.note ? ', ' + i.note : ''}`),
      ...(v.shift.other ? [`Earlier entry ${money(v.shift.other)}`] : [])
    ].join('\n');
    return (
      <span class="l2 tip" data-tip={tip}>
        {moneyMed(v.extra)}
        <span class="src-dots">
          {shown.map(name => {
            const token = name === 'Earlier entry' ? '--cat-other' : `--cat-${name.toLowerCase()}`;
            return <span key={name} style={{ '--cx': `var(${token})` }}>{name}</span>;
          })}
          {more > 0 && <span class="of">+{more}</span>}
        </span>
        <span class="sr-only">{tip.replaceAll('\n', '. ')}</span>
      </span>
    );
  };

  const perHourCell = (v: ShiftView) => {
    if (v.perHour == null || !done(v)) return '';
    const at = standing(rates, v.perHour) ?? 0;
    const diff = sum.perHour == null ? 0 : v.perHour - sum.perHour;
    const tip = `${money(v.perHour)} an hour, all in\nAbove ${Math.round(at * 100)}% of the shifts here\n${money(Math.abs(diff))} ${diff >= 0 ? 'over' : 'under'} the period`;
    return (
      <span class="l2 tip" data-tip={tip}>
        <span class="fig fig-semi">{money(v.perHour)}</span>
        <RankBar at={at} mark={mark} soft width="2.75rem" color={scaleColor(lean(at), 'var(--ink-4)', 70)} />
        <span class="sr-only">{tip.replaceAll('\n', '. ')}</span>
      </span>
    );
  };

  let columns: Column<ShiftView>[] = [
    { key: 'shift', head: grouped ? 'Day' : 'Shift', weight: wt(narrow ? 9.5 : 12), sort: shiftKey,
      cell: v => <DayLine v={v} showMonth={monthInRow(v.shift.date, by)} showYear={by === 'none'} tight={narrow} /> },
    { key: 'tips', head: 'Tips', className: 'c', weight: wt(6.75), sort: v => done(v) ? v.shift.tips : null,
      cell: v => moneyOrStatus(v, moneyMed(v.shift.tips)) },
    { key: 'wage', head: 'Wage', className: 'c hug', weight: wt(5.5), hint: 'Estimated from hours and your hourly wage',
      sort: v => done(v) ? v.wage : null,
      cell: v => {
        if (!done(v) || v.wage == null) return '';
        const tip = `Estimated: ${dec1(v.hours)} hours at ${money(v.wageRate)}/hr, the wage in effect ${shortDate(v.shift.date)}`;
        return (
          <span class="l2 tip" data-tip={tip}>
            {moneyMed(v.wage)}
            <span class="sub">{dec1(v.hours)}h × {money(v.wageRate)}</span>
            <span class="sr-only">{tip}</span>
          </span>
        );
      } },
    { key: 'other', head: 'Other', fill: true, minRem: tier === 'wide' ? 10 : 7.5, sort: v => done(v) ? v.extra : null, cell: otherCell },
    { key: 'total', head: 'Total', className: 'c hug', weight: wt(narrow ? 5.75 : 6.5), sort: v => done(v) ? v.total : null,
      cell: v => done(v) ? <TotalFigure amount={v.total} parts={rowParts(v)} lead shares /> : '' },
    { key: 'perHour', head: '$/hr', className: 'c hug', weight: wt(narrow ? 5 : 6), hint: 'Everything earned over hours. Not Rate, which is tips only.',
      sort: v => v.perHour, cell: perHourCell },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];
  if (narrow) columns = columns.filter(c => ['shift', 'total', 'perHour', 'go'].includes(c.key));

  const bandCells = (key: string) => {
    const g = groups.find(x => x.key === key);
    if (!g) return {};
    const s = summarize(g.views);
    const doneViews = g.views.filter(done);
    return {
      shift: bandOf(key, by, g),
      tips: moneyMed(s.tips, true),
      wage: moneyMed(s.wage, true),
      other: s.extra ? moneyMed(s.extra, true) : '',
      total: <TotalFigure amount={s.total} parts={summedParts(doneViews)} shares />,
      perHour: s.perHour == null ? '' : <span class="fig fig-semi">{money(s.perHour)}</span>
    };
  };

  const foot = {
    shift: <FootCount counted={sum.shifts} pending={rows.length - sum.shifts} />,
    tips: moneyMed(sum.tips), wage: moneyMed(sum.wage), other: moneyMed(sum.extra),
    total: <TotalFigure amount={sum.total} parts={summedParts(rows.filter(done))} shares />,
    perHour: <span class="fig">{money(sum.perHour)}</span>
  };

  const table = rows.length === 0
    ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
    : (
      <Table log fill paginate label="Shift table · Pay" rows={rows} columns={columns} rowKey={v => v.shift.id}
        onRow={v => openSheet(v.shift.id)} defaultSort={{ key: 'shift', dir: 'desc' }} foot={foot}
        tone={v => (done(v) ? undefined : 'muted')}
        group={grouped ? v => (by === 'month' ? monthKey(v.shift.date) : weekStart(v.shift.date)) : undefined}
        groupCells={grouped ? bandCells : undefined} holdGroups={grouped ? 'shift' : undefined} />
    );

  return {
    table,
    side: <PaySide rows={rows} />,
    summary: (
      <div class="sheet-summary">
        <MiniStat label="Total" value={dollars(sum.total)} />
        <MiniStat label="$/hr all in" value={money(sum.perHour)} />
      </div>
    )
  };
}
