import type { ComponentChildren } from 'preact';
import { LOCATIONS } from '../../../core/core.generated.js';
import { monthKey, weekStart } from '../../../lib/dates.ts';
import { DASH, clockParts, dec1, dollars, money, shortDate, weekdayShort, yearTag } from '../../../lib/format.ts';
import { bandLabel, groupShifts, shiftStatus } from '../../../lib/groups.ts';
import { lean, scaleColor, standing } from '../../../lib/meters.ts';
import { summarize } from '../../../lib/stats.ts';
import type { ShiftView } from '../../../lib/stats.ts';
import { openSheet } from '../../../router.ts';
import { ShiftStatusPill } from '../../../ui/Badges.tsx';
import { EmptyState } from '../../../ui/EmptyState.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { RankBar } from '../../../ui/Meters.tsx';
import { Table } from '../../../ui/Table.tsx';
import type { Column } from '../../../ui/Table.tsx';
import { FootCount, hoursFig, moneyMed, shiftKey, wt } from '../bits.tsx';
import { SHEET_PHONE_HIDDEN, sheetHiddenRaw } from '../views.ts';
import type { SheetCtx } from '../views.ts';

const done = (v: ShiftView) => shiftStatus(v) === 'done';
const endMin = (v: ShiftView) => v.shift.start == null || v.shift.end == null ? null : v.shift.end < v.shift.start ? v.shift.end + 1440 : v.shift.end;
const clk = (m: number | null) => {
  if (m == null) return <span class="nil">{DASH}</span>;
  const p = clockParts(m);
  return <span class="clk">{p.hm}<small>{p.ap}</small></span>;
};

export const SHEET_COLUMNS: { key: string; label: string }[] = [
  ['date', 'Date'], ['weekday', 'Day'], ['type', 'Type'], ['party', 'Party'], ['status', 'Status'],
  ['start', 'Start'], ['end', 'End'], ['hours', 'Hours'], ['tips', 'Tips'], ['rate', 'Rate'],
  ['wage', 'Wage'], ['other', 'Other'], ['total', 'Total'], ['perHour', '$/hr'],
  ['crew', 'Crew'], ['barHours', 'Bar hours'], ['stations', 'Stations'], ['note', 'Note']
].map(([key, label]) => ({ key: key!, label: label! }));

export function sheetHidden(tier: SheetCtx['tier']): string[] {
  if (sheetHiddenRaw.value === '-') return [];
  if (sheetHiddenRaw.value) return sheetHiddenRaw.value.split(',').filter(Boolean);
  return tier === 'narrow' ? SHEET_PHONE_HIDDEN : [];
}

export function sheetParts(ctx: SheetCtx): { table: ComponentChildren; side: null; summary: null } {
  const { rows, by, tier } = ctx;
  const grouped = by !== 'none';
  const sum = summarize(rows);
  const groups = grouped ? groupShifts(rows, by) : [];
  const hidden = new Set(sheetHidden(tier));
  const rates = rows.filter(done).map(v => v.tph).filter((n): n is number => n != null);
  const best = Math.max(0, ...rates);
  const gsum = (key: string, pick: (v: ShiftView) => number) => {
    const g = groups.find(x => x.key === key);
    return g ? g.views.filter(done).reduce((t, v) => t + pick(v), 0) : 0;
  };

  const columns = ([
    { key: 'date', head: 'Date', group: 'Shift', weight: wt(8.5), sort: shiftKey,
      cell: v => <span class="fig fig-semi">{shortDate(v.shift.date)}{yearTag(v.shift.date) && <span class="sub"> {yearTag(v.shift.date)}</span>}</span> },
    { key: 'weekday', head: 'Day', group: 'Shift', weight: wt(3.5), sort: v => v.shift.date, cell: v => <span style={{ color: 'var(--ink-2)' }}>{weekdayShort(v.shift.date)}</span> },
    { key: 'type', head: 'Type', group: 'Shift', weight: wt(5), sort: v => v.shift.shift_type,
      cell: v => v.shift.shift_type ? <span class="with"><Icon name={v.shift.shift_type === 'day' ? 'sun' : 'moon'} />{v.shift.shift_type === 'day' ? 'Day' : 'Night'}</span> : <span class="nil">{DASH}</span> },
    { key: 'party', head: 'Party', group: 'Shift', weight: wt(3), sort: v => (v.shift.party ? 1 : 0),
      cell: v => v.shift.party ? <Icon name="star" /> : '' },
    { key: 'status', head: 'Status', group: 'Shift', weight: wt(7.5), sort: v => shiftStatus(v), cell: v => <ShiftStatusPill status={shiftStatus(v)} /> },
    { key: 'start', head: 'Start', group: 'Time', className: 'c', weight: wt(3.5), sort: v => v.shift.start, cell: v => clk(v.shift.start) },
    { key: 'end', head: 'End', group: 'Time', className: 'c', weight: wt(3.5), sort: v => endMin(v), cell: v => clk(v.shift.end) },
    { key: 'hours', head: 'Hours', group: 'Time', className: 'c', weight: wt(2.75), sort: v => v.hours, cell: v => hoursFig(v.hours) },
    { key: 'tips', head: 'Tips', group: 'Pay', className: 'c', weight: wt(5), sort: v => v.shift.tips,
      cell: v => v.shift.tips == null ? <span class="nil">{DASH}</span> : <span class="fig fig-semi">{dollars(v.shift.tips)}</span> },
    { key: 'rate', head: 'Rate', group: 'Pay', className: 'c', weight: wt(7), sort: v => v.tph,
      cell: v => {
        if (!done(v) || v.tph == null || !best) return <span class="nil">{DASH}</span>;
        const at = standing(rates, v.tph) ?? 0;
        const tip = `Better than ${Math.round(at * 100)}% of the shifts here`;
        return <span class="with tip" style={{ justifyContent: 'flex-end' }} data-tip={tip}><RankBar at={v.tph / best} width="2.5rem" color={scaleColor(lean(at), 'var(--ink-4)', 80)} /><span class="fig">{money(v.tph)}</span></span>;
      } },
    { key: 'wage', head: 'Wage', group: 'Pay', className: 'c', weight: wt(5), sort: v => v.wage, cell: v => v.wage == null ? '' : moneyMed(v.wage) },
    { key: 'other', head: 'Other', group: 'Pay', className: 'c', weight: wt(5), sort: v => v.extra,
      cell: v => v.extra ? <span class="tip" data-tip={v.income.map(i => `${i.category} ${money(i.amount)}`).join('\n')}>{moneyMed(v.extra)}</span> : '' },
    { key: 'total', head: 'Total', group: 'Pay', className: 'c', weight: wt(5.5), sort: v => done(v) ? v.total : null,
      cell: v => done(v) ? <span class="fig fig-semi">{dollars(v.total)}</span> : '' },
    { key: 'perHour', head: '$/hr', group: 'Pay', className: 'c', weight: wt(5.5), hint: 'Everything earned over hours', sort: v => v.perHour,
      cell: v => v.perHour == null ? '' : <span class="fig fig-q">{money(v.perHour)}</span> },
    { key: 'crew', head: 'Crew', group: 'Crew', className: 'c', weight: wt(3.5), sort: v => v.crewCount, cell: v => v.crewCount || <span class="nil">{DASH}</span> },
    { key: 'barHours', head: 'Bar h', group: 'Crew', className: 'c', weight: wt(4.5), hint: "Everyone's hours on the bar", sort: v => v.crewHours,
      cell: v => v.crewCount ? dec1(v.crewHours) : <span class="nil">{DASH}</span> },
    { key: 'stations', head: 'Stations', group: 'Crew', weight: wt(7), sort: v => v.crew.filter(c => c.location === 'Main').length,
      cell: v => {
        const sc = LOCATIONS.map(l => [l, v.crew.filter(c => c.location === l).length] as const).filter(x => x[1]);
        if (!sc.length) return '';
        return <span class="with" style={{ gap: '3px' }}>{sc.map(([l, n]) => <span key={l} class="spot" data-spot={l}>{l[0]} {n}</span>)}</span>;
      } },
    { key: 'note', head: 'Note', group: 'Note', fill: true, minRem: 10, sort: v => v.shift.notes,
      cell: v => v.shift.notes ? <span class="names" title={v.shift.notes}>{v.shift.notes}</span> : '' }
  ] satisfies Column<ShiftView>[]).filter(c => !hidden.has(c.key));

  const bandCells = (key: string) => {
    const g = groups.find(x => x.key === key);
    if (!g) return {};
    const { name, title } = bandLabel(key, by);
    const s = summarize(g.views);
    return {
      date: <span class="band-name" title={title}>{name}</span>,
      hours: hoursFig(gsum(key, v => v.hours ?? 0), true),
      tips: <span class="fig fig-semi">{dollars(gsum(key, v => v.shift.tips ?? 0))}</span>,
      wage: moneyMed(gsum(key, v => v.wage ?? 0), true),
      other: gsum(key, v => v.extra) ? moneyMed(gsum(key, v => v.extra), true) : '',
      total: <span class="fig fig-semi">{dollars(s.total)}</span>,
      rate: s.tph == null ? '' : <span class="fig fig-semi">{money(s.tph)}</span>,
      barHours: <span class="fig fig-semi">{dec1(gsum(key, v => v.crewHours))}</span>
    };
  };

  const table = rows.length === 0
    ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
    : (
      <Table grid log fill paginate label="Shift table · Sheet" rows={rows} columns={columns} rowKey={v => v.shift.id}
        onRow={v => openSheet(v.shift.id)} defaultSort={{ key: 'date', dir: 'desc' }}
        foot={{
          date: <FootCount counted={sum.shifts} pending={rows.length - sum.shifts} />,
          hours: hoursFig(sum.hours, true), tips: <span class="fig">{dollars(sum.tips)}</span>,
          wage: moneyMed(sum.wage), other: moneyMed(sum.extra), total: <span class="fig">{dollars(sum.total)}</span>,
          rate: <span class="fig">{money(sum.tph)}</span>, perHour: <span class="fig">{money(sum.perHour)}</span>,
          barHours: <span class="fig">{dec1(sum.crewHours)}</span>
        }}
        tone={v => (done(v) ? undefined : 'muted')}
        group={grouped ? v => (by === 'month' ? monthKey(v.shift.date) : weekStart(v.shift.date)) : undefined}
        groupCells={grouped ? bandCells : undefined} holdGroups={grouped ? 'date' : undefined} />
    );
  return { table, side: null, summary: null };
}
