import { scopedViews } from '../../data/scope.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { sheetProblems, state, syncMessage } from '../../data/sync.ts';
import { shortDate, money, moneyWhole, hours, clockShort, dollars, perHour, isPastYear, weekdayShort, DASH } from '../../lib/format.ts';
import { groupByWeek, rateTone, summarize, weekEnd } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import { RatePill, TypeIcon } from '../../ui/Badges.tsx';
import { Avatar } from '../../ui/Avatar.tsx';
import { StatList, TimeBar } from '../../ui/kpi.tsx';
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

/* A cleanup pass on the multiline layout: the weekday sits above the date instead of beside it, Start/End
   fold into Hours as its subtext instead of taking two columns of their own, and every money column's
   rate is a plain toned line (RatePill's bare form) under the figure, not a pill — a pill's own padding
   was throwing off the row's rhythm next to plain text. Not linked from a nav group; open it at #/log/multi. */
const CREW_SHOWN = 3;

export function LogMultiScreen() {
  const all = liveViews.value;
  const views = scopedViews(all);
  const s = summarize(views);
  const weeks = groupByWeek(views);
  const problems = sheetProblems.value;
  const selected = sheet.value;
  const showTable = isDesktop.value;   // desktop is the table; a phone gets cards

  /* Every earned figure — Tips, Wage, Other, Total — gets its own column: the amount on top, a plain
     toned per-hour line under it (no pill), against this period's own average for that figure. */
  const wageAvg = s.hours ? s.wage / s.hours : null;
  const otherAvg = s.hours ? s.extra / s.hours : null;
  const earnCol = (amount: number | null, v: ShiftView, avg: number | null) => {
    if (amount == null || amount === 0) return <span class="muted">{DASH}</span>;
    const perHr = v.hours ? amount / v.hours : null;
    return <Stack title={dollars(amount)} lines={[<RatePill tph={perHr} tone={rateTone(perHr, avg)} />]} />;
  };
  const columns: Column<ShiftView>[] = [
    { key: 'date', head: 'Shift', className: 'when', sort: v => v.shift.date, cell: v => {
      const a = clockShort(v.shift.start), b = clockShort(v.shift.end);
      const time = a && b ? `${a}–${b}` : (a || b || '');
      const meta = (time || v.shift.party) ? <>{time}{v.shift.party && <Icon name="star" />}</> : null;
      return (
        <span class="shiftcell">
          {v.shift.shift_type ? <TypeIcon type={v.shift.shift_type} /> : <span class="tbadge" aria-hidden="true" />}
          <Stack title={<>{weekdayShort(v.shift.date)} <DateCell d={v.shift.date} /></>} lines={meta ? [meta] : []} />
        </span>
      );
    } },
    { key: 'hours', head: 'Hours', className: 'fit', sort: v => v.hours, cell: v => (
      <Stack title={hours(v.hours)} lines={[<TimeBar start={v.shift.start} end={v.shift.end} />]} />
    ) },
    { key: 'tips', head: 'Tips', className: 'earn strong', sort: v => v.shift.tips, cell: v => earnCol(v.shift.tips, v, s.tph) },
    { key: 'wage', head: 'Wage', className: 'earn', sort: v => v.wage, cell: v => earnCol(v.wage, v, wageAvg) },
    { key: 'other', head: 'Other', className: 'earn', sort: v => v.extra, cell: v => earnCol(v.extra, v, otherAvg) },
    { key: 'total', head: 'Total', className: 'earn strong', sort: v => v.total, cell: v => earnCol(v.total, v, s.perHour) },
    { key: 'crew', head: 'Crew', className: 'fit', sort: v => v.crewCount || null, cell: v => v.crewCount ? (
      <span class="avatars">
        {v.crew.slice(0, CREW_SHOWN).map(c => <Avatar key={c.id} id={c.staff_id} name={personById(c.staff_id)?.name ?? c.name ?? '?'} />)}
        {v.crewCount > CREW_SHOWN && <span class="avatar avatar-more">+{v.crewCount - CREW_SHOWN}</span>}
      </span>
    ) : <span class="muted">{DASH}</span> }
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
    <section class={`panel ${showTable ? 'fill' : ''}`} aria-labelledby="log-multi-title">
      <PanelHead title="Shift log (multiline)" id="log-multi-title"><ScopeControl /></PanelHead>
      {showTable ? (
        <div class="split">
          <div class={`panel-body flush tbl-tight ${styles.body}`}>
            {alerts}
            {empty ?? <Table fill paginate label="Shifts" rows={views} columns={columns} rowKey={v => v.shift.id} onRow={v => openSheet(v.shift.id)} selectedId={selected}
              defaultSort={{ key: 'date', dir: 'desc' }} />}
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
