import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { liveViews } from '../../data/store.ts';
import { today } from '../../lib/dates.ts';
import { openForm, openSheet } from '../../router.ts';
import { MONTH_NAMES, MonthCalendar, MonthNav } from '../../ui/MonthCalendar.tsx';
import type { Month } from '../../ui/MonthCalendar.tsx';
import { StackView } from './StackView.tsx';

/* Calendar, two ways. Month: one big month where a day with a shift is one card that opens it and an empty day is one button that starts a
 * new shift. Three months: the months stacked with their totals, table, chart and best / slowest lists beside them. Either way a day is
 * shaded by its tips per hour against the typical shift in view. The month and its nav are the panel head. */
type View = 'month' | 'stack';
const view = signal<View>((() => { try { return localStorage.getItem('cal:view') === 'stack' ? 'stack' : 'month'; } catch { return 'month'; } })());
const setView = (v: View) => { view.value = v; try { localStorage.setItem('cal:view', v); } catch { /* private mode */ } };

export function CalendarScreen() {
  const t = today();
  const [month, setMonth] = useState<Month>({ y: +t.slice(0, 4), m: +t.slice(5, 7) - 1 });
  const stack = view.value === 'stack';
  const first = new Date(Date.UTC(month.y, month.m - 2, 1));
  const title = stack
    ? (first.getUTCFullYear() === month.y ? `${MONTH_NAMES[first.getUTCMonth()]!.slice(0, 3)} – ${MONTH_NAMES[month.m]!.slice(0, 3)} ${month.y}` : `${MONTH_NAMES[first.getUTCMonth()]!.slice(0, 3)} ${first.getUTCFullYear()} – ${MONTH_NAMES[month.m]!.slice(0, 3)} ${month.y}`)
    : `${MONTH_NAMES[month.m]} ${month.y}`;
  return (
    <section class="panel" aria-labelledby="cal-title">
      <header class="panel-head">
        <h2 id="cal-title" aria-live="polite">{title}</h2>
        <div class="panel-tools">
          <div class="seg" role="radiogroup" aria-label="Calendar view">
            <label><input type="radio" name="cal-view" checked={!stack} onChange={() => setView('month')} /><span>Month</span></label>
            <label><input type="radio" name="cal-view" checked={stack} onChange={() => setView('stack')} /><span>3 months</span></label>
          </div>
          <MonthNav month={month} onMonth={setMonth} />
        </div>
      </header>
      <div class="panel-body">
        {stack
          ? <StackView all={liveViews.value} end={month} />
          : <MonthCalendar mode="browse" views={liveViews.value} month={month} onMonth={setMonth} onOpen={id => openSheet(id)} onNew={d => openForm('new', d)} />}
      </div>
    </section>
  );
}
