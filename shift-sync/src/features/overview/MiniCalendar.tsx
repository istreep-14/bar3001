import { useState } from 'preact/hooks';
import { byDate, monthGrid, rateScale } from '../../lib/calendar.ts';
import { today as todayText } from '../../lib/dates.ts';
import { moneyWhole, perHour } from '../../lib/format.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { Icon } from '../../ui/Icon.tsx';
import { MONTH_NAMES, RateKey } from '../../ui/MonthCalendar.tsx';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* The month at a glance, shaded the way the Calendar is: a day with a shift leans on the primary colour when its tips per
 * hour beat the month's typical shift and on amber when they fall short, deeper the further out; a day still waiting on its
 * money stays plain. Tap a day to open its shift. The full calendar is one link away. */
export function MiniCalendar({ views, onOpen }: { views: ShiftView[]; onOpen: (id: string) => void }) {
  const today = todayText();
  const [view, setView] = useState({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
  const days = byDate(views), cells = monthGrid(view.y, view.m);
  const key = `${view.y}-${String(view.m + 1).padStart(2, '0')}`;
  const scale = rateScale(views.filter(v => v.shift.date.startsWith(key)).map(v => v.tph));
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
          const d = summarize(list), h = scale?.at(d.tph);
          const says = `${d.tph == null ? 'no rate yet' : perHour(d.tph)} · ${moneyWhole(d.total)}`;
          return (
            <button type="button" key={c.date} class={cls} data-side={h?.side} style={h ? { '--heat': String(h.mag) } : undefined}
              title={`${says} · ${list.length} shift${list.length === 1 ? '' : 's'}`} aria-label={`${c.date}: ${says}`} onClick={() => onOpen(list[0]!.shift.id)}>{n}</button>
          );
        })}
      </div>
      <RateKey scale={scale} />
    </figure>
  );
}
