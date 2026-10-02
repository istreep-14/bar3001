import type { ComponentChildren } from 'preact';
import { LOCATIONS } from '../../../core/core.generated.js';
import { monthKey, weekStart } from '../../../lib/dates.ts';
import { DASH, dec1, money, perHour } from '../../../lib/format.ts';
import { groupShifts, monthInRow, shiftStatus } from '../../../lib/groups.ts';
import { rateContext, summarize } from '../../../lib/stats.ts';
import type { ShiftView } from '../../../lib/stats.ts';
import { personById } from '../../../data/store.ts';
import { CrewStack } from '../../../parts/CrewStack.tsx';
import { DayLine } from '../../../parts/DayLine.tsx';
import { openSheet } from '../../../router.ts';
import { ShiftStatusPill } from '../../../ui/Badges.tsx';
import { EmptyState } from '../../../ui/EmptyState.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { RankBar, SegMeter } from '../../../ui/Meters.tsx';
import { RateFigure } from '../../../ui/RateFigure.tsx';
import { Table } from '../../../ui/Table.tsx';
import type { Column } from '../../../ui/Table.tsx';
import { MiniStat } from '../../../ui/kpi.tsx';
import { FootCount, bandOf, hoursFig, shiftKey, wt } from '../bits.tsx';
import type { SheetCtx } from '../views.ts';

const done = (v: ShiftView) => shiftStatus(v) === 'done';
const nameOf = (c: ShiftView['crew'][number]) => personById(c.staff_id)?.name ?? c.name ?? 'Someone';

export function staffingParts(ctx: SheetCtx): { table: ComponentChildren; side: ComponentChildren; summary: ComponentChildren } {
  const { rows, by, tier } = ctx;
  const narrow = tier === 'narrow';
  const wide = tier === 'wide';
  const grouped = by !== 'none';
  const sum = summarize(rows);
  const groups = grouped ? groupShifts(rows, by) : [];
  const ctxRate = rateContext(rows.filter(done));
  const doneV = rows.filter(done);
  const people = new Set(rows.flatMap(v => v.crew.map(c => c.staff_id))).size;
  const avgSize = doneV.length ? doneV.reduce((t, v) => t + v.crewCount, 0) / doneV.length : 0;

  const names = (v: ShiftView) => {
    const list = v.crew.map(nameOf);
    return list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '');
  };

  let columns: Column<ShiftView>[] = [
    { key: 'shift', head: grouped ? 'Day' : 'Shift', weight: wt(narrow ? 9.5 : 12), sort: shiftKey,
      cell: v => <DayLine v={v} showMonth={monthInRow(v.shift.date, by)} showYear={by === 'none'}
        sub={narrow && !done(v) ? <span class="day-sub"><ShiftStatusPill status={shiftStatus(v)} compact /></span> : undefined} /> },
    { key: 'people', head: 'On the bar', fill: true, minRem: narrow ? 8 : 12, sort: v => v.crew[0] ? nameOf(v.crew[0]) : null,
      cell: v => v.crew.length
        ? <span class="with"><CrewStack crew={v.crew} max={narrow ? 4 : 6} sm={narrow} crewHours={v.crewHours} />{!narrow && <span class="names">{names(v)}</span>}</span>
        : <span class="with"><span class="avatar-empty" aria-hidden="true" /><span class="nil">No crew logged</span></span> },
    { key: 'stations', head: 'Stations', weight: wt(7), sort: v => v.crew.filter(c => c.location === 'Main').length,
      cell: v => {
        const sc = LOCATIONS.map(l => [l, v.crew.filter(c => c.location === l)] as const).filter(x => x[1].length);
        if (!sc.length) return '';
        const tip = sc.map(([l, cs]) => `${l}: ${cs.map(nameOf).join(', ')}`).join('\n');
        return <span class="tip" data-tip={tip}>{sc.map(([l, cs]) => <span key={l} class="spot" data-spot={l}>{l} {cs.length}</span>)}<span class="sr-only">{tip.replaceAll('\n', '. ')}</span></span>;
      } },
    { key: 'size', head: 'Size', className: 'c', weight: wt(3.5), sort: v => v.crewCount,
      cell: v => (
        <span class="l2 tip" data-tip={`${v.crewCount} on the bar`}>
          <span class="fig fig-key">{v.crewCount}</span>
          {wide ? <SegMeter n={Math.min(6, v.crewCount)} of={6} /> : v.crewHours ? <span class="sub">{dec1(v.crewHours)}h</span> : ''}
        </span>
      ) },
    { key: 'barHours', head: 'Bar hours', className: 'c hug', weight: wt(5), hint: "Everyone's hours on the bar, added up", sort: v => v.crewHours,
      cell: v => v.crewHours ? <span class="l2">{hoursFig(v.crewHours)}<span class="sub">{dec1(v.crewHours / Math.max(1, v.crew.length))}h each</span></span> : '' },
    { key: 'rate', head: 'Rate', className: 'c hug', weight: wt(narrow ? 5.5 : 5.75), sort: v => v.tph,
      cell: v => !done(v) ? (narrow ? '' : <ShiftStatusPill status={shiftStatus(v)} compact />) : v.tph == null ? <span class="nil">{DASH}</span> : <RateFigure tph={v.tph} ctx={ctxRate} compact /> },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];
  if (!wide) columns = columns.filter(c => c.key !== 'barHours');
  if (tier === 'mid') columns = columns.filter(c => c.key !== 'stations');
  if (narrow) columns = columns.filter(c => ['shift', 'people', 'rate', 'go'].includes(c.key));

  const bandCells = (key: string) => {
    const g = groups.find(x => x.key === key);
    if (!g) return {};
    const s = summarize(g.views);
    const size = g.views.length ? g.views.reduce((t, v) => t + v.crewCount, 0) / g.views.length : 0;
    return {
      shift: bandOf(key, by, g),
      size: <span class="fig fig-semi">{dec1(size)}</span>,
      barHours: hoursFig(s.crewHours, true),
      rate: s.tph == null ? '' : <span class="fig fig-semi">{money(s.tph)}</span>
    };
  };

  const sizes = [...new Set(doneV.map(v => v.crewCount))].sort((a, b) => a - b).map(n => {
    const g = doneV.filter(v => v.crewCount === n);
    return { n, k: g.length, tph: summarize(g).tph };
  }).filter(x => x.tph != null);
  const best = Math.max(0, ...sizes.map(x => x.tph ?? 0));

  const table = rows.length === 0
    ? <EmptyState title="No shifts match">Clear the search or a filter.</EmptyState>
    : (
      <Table log fill paginate label="Shift table · Staffing" rows={rows} columns={columns} rowKey={v => v.shift.id}
        onRow={v => openSheet(v.shift.id)} defaultSort={{ key: 'shift', dir: 'desc' }}
        foot={{
          shift: <FootCount counted={sum.shifts} pending={rows.length - sum.shifts} />,
          people: <span class="foot-label">{people} people</span>,
          size: <span class="fig">avg {doneV.length ? dec1(avgSize) : DASH}</span>,
          barHours: hoursFig(sum.crewHours, true),
          rate: <span class="fig fig-semi">{money(sum.tph)}</span>
        }}
        tone={v => (done(v) ? undefined : 'muted')}
        group={grouped ? v => (by === 'month' ? monthKey(v.shift.date) : weekStart(v.shift.date)) : undefined}
        groupCells={grouped ? bandCells : undefined} holdGroups={grouped ? 'shift' : undefined} />
    );

  return {
    table,
    side: (
      <>
        <div class="side-block">
          <h3 class="label">Crew this period</h3>
          <dl class="stats">
            <div><dt>On the bar</dt><dd>avg {doneV.length ? dec1(avgSize) : DASH}</dd></div>
            <div><dt>Bar hours</dt><dd>{dec1(sum.crewHours)}h</dd></div>
            <div><dt>People seen</dt><dd>{people}</dd></div>
          </dl>
        </div>
        {sizes.length > 0 && (
          <div class="side-block">
            <h3 class="label">Rate by crew size</h3>
            <div class="sl">
              {sizes.map(x => (
                <div key={x.n} class="sl-row" style={{ cursor: 'default', display: 'grid' }}>
                  <span class="with" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span class="sub">{x.n} on the bar · {x.k} shift{x.k === 1 ? '' : 's'}</span>
                    <b>{perHour(x.tph)}</b>
                  </span>
                  <RankBar at={(x.tph ?? 0) / (best || 1)} color="var(--accent)" soft />
                </div>
              ))}
            </div>
            <p class="muted side-note">Hours and Rate only, never a ranking of people.</p>
          </div>
        )}
      </>
    ),
    summary: (
      <div class="sheet-summary">
        <MiniStat label="avg size" value={doneV.length ? dec1(avgSize) : DASH} />
        <MiniStat label="Rate" value={perHour(sum.tph)} />
      </div>
    )
  };
}
