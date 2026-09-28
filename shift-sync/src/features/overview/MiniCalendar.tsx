import { useState } from 'preact/hooks';
import { byDate, heat, monthGrid } from '../../lib/calendar.ts';
import { today as todayText } from '../../lib/dates.ts';
import { moneyWhole } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { Icon } from '../../ui/Icon.tsx';
import { MONTH_NAMES } from '../../ui/MonthCalendar.tsx';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* The month at a glance: a day is shaded when a shift was worked (darker = it earned more against the month's best).
 * Tap a shaded day to open its shift. The full calendar is one link away. */
export function MiniCalendar({ views, onOpen }: { views: ShiftView[]; onOpen: (id: string) => void }) {
  const today = todayText();
  const [view, setView] = useState({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
  const days = byDate(views), cells = monthGrid(view.y, view.m);
  const total = (d: string) => (days.get(d) ?? []).reduce((a, v) => a + v.total, 0);
  const best = Math.max(0, ...cells.filter(c => c.inMonth).map(c => total(c.date)));
  const go = (n: number) => setView(c => { const t = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; });
  return (
    <figure class="viz">
      <figcaption class="viz-cap">
        <h4>{MONTH_NAMES[view.m]} {view.y}</h4>
        <span class="minink">
          <button type="button" class="icon-btn" aria-label="Previous month" onClick={() => go(-1)}><Icon name="left" /></button>
          <button type="button" class="icon-btn" aria-label="Next month" onClick={() => go(1)}><Icon name="chevron" /></button>
          <a class="linkbtn" href="#/calendar">Open calendar</a>
        </span>
      </figcaption>
      <div class="mini" role="group" aria-label={`${MONTH_NAMES[view.m]} ${view.y}`}>
        {LETTERS.map((l, i) => <span class="dow" key={i} aria-hidden="true">{l}</span>)}
        {cells.map(c => {
          const list = days.get(c.date) ?? [], n = +c.date.slice(8);
          const cls = 'md' + (c.inMonth ? '' : ' out') + (list.length && c.inMonth ? ' has' : '') + (c.date === today ? ' today' : '');
          if (!list.length || !c.inMonth) return <span key={c.date} class={cls}>{n}</span>;
          return (
            <button type="button" key={c.date} class={cls} style={{ '--heat': String(heat(total(c.date), best)) }} title={`${moneyWhole(total(c.date))} · ${list.length} shift${list.length === 1 ? '' : 's'}`}
              aria-label={`${c.date}: ${moneyWhole(total(c.date))}`} onClick={() => onOpen(list[0]!.shift.id)}>{n}</button>
          );
        })}
      </div>
    </figure>
  );
}
