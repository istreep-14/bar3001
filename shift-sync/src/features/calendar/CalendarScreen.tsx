import { useState } from 'preact/hooks';
import { liveViews, viewById } from '../../data/store.ts';
import { today } from '../../lib/dates.ts';
import { MONTH_NAMES, MONTH_SHORT, longDate } from '../../lib/format.ts';
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

/* Calendar, two ways. Month: one big month where a day with a shift is one card that opens it and an empty day is one button that starts a
 * new shift. On desktop the opened shift shows in the side column beside the month (the same ShiftDetails as the Log's card and the
 * drawer, so the floating drawer stays shut here), with the month's totals under it. Three months: the months stacked with their totals, table, chart and best / slowest lists beside them. Either way a day is
 * shaded by its tips per hour against the typical shift in view. The month and its nav are the panel head. */
type View = 'month' | 'stack';
const [view, setView] = persisted<View>('cal:view', oneOf(['month', 'stack'] as const), 'month');

export function CalendarScreen() {
  const t = today();
  const [month, setMonth] = useState<Month>({ y: +t.slice(0, 4), m: +t.slice(5, 7) - 1 });
  const stack = view.value === 'stack';
  const first = new Date(Date.UTC(month.y, month.m - 2, 1));
  const title = stack
    ? (first.getUTCFullYear() === month.y ? `${MONTH_SHORT[first.getUTCMonth()]} – ${MONTH_SHORT[month.m]} ${month.y}` : `${MONTH_SHORT[first.getUTCMonth()]} ${first.getUTCFullYear()} – ${MONTH_SHORT[month.m]} ${month.y}`)
    : `${MONTH_NAMES[month.m]} ${month.y}`;
  return (
    <Page title={title} id="cal-title" live tools={
      <>
        <div class="seg" role="radiogroup" aria-label="Calendar view">
          <label><input type="radio" name="cal-view" checked={!stack} onChange={() => setView('month')} /><span>Month</span></label>
          <label><input type="radio" name="cal-view" checked={stack} onChange={() => setView('stack')} /><span>3 months</span></label>
        </div>
        <MonthNav month={month} onMonth={setMonth} />
      </>
    } side={stack || !isDesktop.value ? undefined : <DaySide month={month} />}>
      {stack
        ? <StackView all={liveViews.value} end={month} />
        : <MonthCalendar mode="browse" views={liveViews.value} month={month} onMonth={setMonth} onOpen={id => openSheet(id)} onNew={d => openForm('new', d)} />}
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
