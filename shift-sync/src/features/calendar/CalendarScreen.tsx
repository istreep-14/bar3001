import { useState } from 'preact/hooks';
import { liveViews, viewById } from '../../data/store.ts';
import { addDays, today } from '../../lib/dates.ts';
import { MONTH_NAMES, MONTH_SHORT, longDate, weekLabel } from '../../lib/format.ts';
import { summarize } from '../../lib/stats.ts';
import { closeSheet, openForm, openSheet, sheet } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import { Page } from '../../ui/Page.tsx';
import { SideStats, periodItems } from '../../ui/SideStats.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import { ShiftDetails } from '../../parts/ShiftDetails.tsx';
import { MonthCalendar, MonthNav } from '../../ui/MonthCalendar.tsx';
import type { Month } from '../../ui/MonthCalendar.tsx';
import { StackView } from './StackView.tsx';
import { oneOf, persisted } from '../../data/persisted.ts';
import { IncomeStack } from '../../parts/blocks/IncomeStack.tsx';
import { WeekCards } from '../../parts/blocks/WeekCards.tsx';
import { WeekTimeline } from '../../parts/blocks/WeekTimeline.tsx';

/* Calendar, three ways. Week: the week as seven day cards across (start times first for the days to come) with the money,
 * income and each bartender's times lined up under them, then the week on one clock (a row per day, each shift a block from
 * start to end, a hairline for each bartender on with you). Month: one big month
 * where a day with a shift is one card that opens it and an empty day is one button that starts a new shift; on desktop the
 * opened shift shows in the side column beside the month (the same ShiftDetails as the drawer, so the floating drawer stays
 * shut here), with the month's totals under it. Three months: the months stacked with their totals, table, chart and best /
 * slowest lists beside them. A day is shaded by its tips per hour against the typical shift in view. */
type View = 'week' | 'month' | 'stack';
const VIEWS: { id: View; label: string }[] = [{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'stack', label: '3 months' }];
/** Whether the week view's Details rows show; remembered on this device. */
const [weekOpen, setWeekOpen] = persisted<boolean>('cal:week-open', (v): v is boolean => typeof v === 'boolean', true);
const [view, setView] = persisted<View>('cal:view', oneOf(['week', 'month', 'stack'] as const), 'month');

export function CalendarScreen() {
  const t = today();
  const [month, setMonth] = useState<Month>({ y: +t.slice(0, 4), m: +t.slice(5, 7) - 1 });
  const [week, setWeek] = useState(0);
  const v = view.value, stack = v === 'stack';
  const first = new Date(Date.UTC(month.y, month.m - 2, 1));
  const title = v === 'week' ? weekLabel(addDays(t, week * 7))
    : stack ? (first.getUTCFullYear() === month.y ? `${MONTH_SHORT[first.getUTCMonth()]} – ${MONTH_SHORT[month.m]} ${month.y}` : `${MONTH_SHORT[first.getUTCMonth()]} ${first.getUTCFullYear()} – ${MONTH_SHORT[month.m]} ${month.y}`)
    : `${MONTH_NAMES[month.m]} ${month.y}`;
  const all = liveViews.value;
  return (
    <Page title={title} id="cal-title" live tools={
      <>
        <div class="seg" role="radiogroup" aria-label="Calendar view">
          {VIEWS.map(o => <label key={o.id}><input type="radio" name="cal-view" checked={v === o.id} onChange={() => setView(o.id)} /><span>{o.label}</span></label>)}
        </div>
        {v === 'week' ? (
          <div class="calnav">
            <button type="button" class="linkbtn" onClick={() => setWeek(0)} disabled={week === 0}>This week</button>
            <button type="button" class="icon-btn" aria-label="Previous week" onClick={() => setWeek(n => n - 1)}><Icon name="left" /></button>
            <button type="button" class="icon-btn" aria-label="Next week" onClick={() => setWeek(n => n + 1)}><Icon name="chevron" /></button>
          </div>
        ) : <MonthNav month={month} onMonth={setMonth} />}
      </>
    } side={v === 'week' || stack || !isDesktop.value ? undefined : <DaySide month={month} />}>
      {v === 'week' ? (
        <div class="cal-week">
          <WeekCards views={all} today={t} offset={week} onOffset={setWeek} nav={false} expandable open={weekOpen.value} onOpen={setWeekOpen} rows={['money', 'sources', 'people']} />
          <WeekTimeline views={all} today={t} offset={week} />
          <IncomeStack views={all} today={addDays(t, week * 7)} weeks={8} height={150} />
        </div>
      ) : stack
        ? <StackView all={all} end={month} />
        : <MonthCalendar mode="browse" views={all} month={month} onMonth={setMonth} onOpen={id => openSheet(id)} onNew={d => openForm('new', d)} />}
    </Page>
  );
}

/** The side column: the open shift as stacked lists, then the month in numbers. */
function DaySide({ month }: { month: Month }) {
  const v = sheet.value ? viewById(sheet.value) : undefined;
  const key = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  const s = summarize(liveViews.value.filter(x => x.shift.date.startsWith(key)));
  return (
    <SideStats ariaLabel="Selected day" label={MONTH_NAMES[month.m]} items={periodItems(s)}>
      {v ? (
        <div class="side-block day-card">
          <div class="day-card-head">
            <h3 class="h-title">{longDate(v.shift.date)}</h3>
            <button type="button" class="btn btn-quiet btn-icon" aria-label="Close" onClick={closeSheet}><Icon name="x" /></button>
          </div>
          <ShiftDetails v={v} layout="stack" />
          <div class="day-card-actions">
            <button type="button" class="btn btn-primary" onClick={() => openForm(v.shift.id)}><Icon name="edit" /> Edit shift</button>
          </div>
        </div>
      ) : (
        <div class="side-block"><p class="muted side-note">Pick a shift to see it here. An empty day starts a new one.</p></div>
      )}
    </SideStats>
  );
}
