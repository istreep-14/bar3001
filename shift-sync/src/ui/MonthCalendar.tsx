import { useEffect, useRef, useState } from 'preact/hooks';
import { addDays, today as todayText } from '../lib/dates.ts';
import { byDate, monthGrid, rateScale } from '../lib/calendar.ts';
import { clockShort, hours, moneyWhole, perHour, perHourWhole, shortDate, weekdayShort } from '../lib/format.ts';
import { summarize } from '../lib/stats.ts';
import type { ShiftView } from '../lib/stats.ts';
import { pctChange } from '../lib/trends.ts';
import { Facts } from './charts.tsx';
import { MiniStat } from './kpi.tsx';
import { PartyIcon, TypeIcon } from './Badges.tsx';
import { Icon } from './Icon.tsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LETTER = { day: 'D', night: 'N' } as const;
const NAME = { day: 'Day', night: 'Night' } as const;
const letter = (t: ShiftView['shift']['shift_type']) => (t ? LETTER[t] : '?');
const typeName = (t: ShiftView['shift']['shift_type']) => (t ? NAME[t] : 'Shift');

export interface Month { y: number; m: number }
export const MONTH_NAMES = MONTHS;

/* A month calendar that shows the shifts you have logged, in two sizes:
 *   pick    the Date page of the shift form: tap a day to set the shift's date. Days that already hold a shift carry
 *           its type (D or N) and tips; arrow keys move between days.
 *   browse  the Calendar page: each shift is a chip (type, hours, income) that opens it, a day's shade is how much it
 *           earned against the month's best, and an empty day starts a new shift on that date.
 * Weeks run Monday to Sunday. `exclude` is the shift being edited (it doesn't count as "already logged"). */
export function MonthCalendar({ mode, views, selected = null, exclude = null, month, onMonth, onPick, onOpen, onNew }: {
  mode: 'pick' | 'browse'; views: ShiftView[]; selected?: string | null; exclude?: string | null; month?: Month; onMonth?: (m: Month) => void;
  onPick?: (date: string) => void; onOpen?: (id: string) => void; onNew?: (date: string) => void;
}) {
  const today = todayText();
  const start = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : today;
  const [own, setOwn] = useState<Month>({ y: +start.slice(0, 4), m: +start.slice(5, 7) - 1 });
  const view = month ?? own, setView = (v: Month | ((c: Month) => Month)) => { const next = typeof v === 'function' ? v(view) : v; (onMonth ?? setOwn)(next); };
  const grid = useRef<HTMLDivElement>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  // Turn to the month of the chosen date when it changes from outside (typing a date in the form).
  useEffect(() => { if (selected && /^\d{4}-\d{2}-\d{2}$/.test(selected)) setView({ y: +selected.slice(0, 4), m: +selected.slice(5, 7) - 1 }); }, [selected?.slice(0, 7)]);
  useEffect(() => { if (focusDate) grid.current?.querySelector<HTMLElement>(`button.day[data-date="${focusDate}"]`)?.focus({ preventScroll: true }); }, [focusDate, view.y, view.m]);

  const days = byDate(views.filter(v => v.shift.id !== exclude));
  const cells = monthGrid(view.y, view.m);
  const monthKey = `${view.y}-${String(view.m + 1).padStart(2, '0')}`;
  const inMonth = views.filter(v => v.shift.id !== exclude && v.shift.date.startsWith(monthKey));
  const totals = summarize(inMonth);
  const prevKey = (() => { const d = new Date(Date.UTC(view.y, view.m - 1, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; })();
  const before = summarize(views.filter(v => v.shift.id !== exclude && v.shift.date.startsWith(prevKey)));
  const scale = rateScale(inMonth.map(v => v.tph));   // browse shading: each shift's rate against the typical shift this month
  const tabStop = selected && selected.startsWith(monthKey) ? selected : today.startsWith(monthKey) ? today : `${monthKey}-01`;

  const onKey = (e: KeyboardEvent) => {
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    const from = (e.target as HTMLElement).closest<HTMLElement>('button.day')?.dataset.date;
    if (!delta || !from) return;
    e.preventDefault();
    const to = addDays(from, delta);
    if (!to.startsWith(monthKey)) setView({ y: +to.slice(0, 4), m: +to.slice(5, 7) - 1 });
    setFocusDate(to);
  };

  return (
    <div class={'cal cal-' + mode} style={{ '--rows': String(cells.length / 7) }}>
      {mode === 'pick' && (
        <div class="calhead">
          <h3 class="caltitle" aria-live="polite">{MONTHS[view.m]} {view.y}</h3>
          <MonthNav month={view} onMonth={setView} />
        </div>
      )}
      <div class="calgrid" ref={grid} role={mode === 'pick' ? 'group' : 'presentation'} aria-label={`${MONTHS[view.m]} ${view.y}`} onKeyDown={onKey}>
        {DOW.map(d => <span class="dow" key={d} aria-hidden="true">{d}</span>)}
        {cells.map(c => {
          const list = days.get(c.date) ?? [];
          const n = +c.date.slice(8);
          const cls = 'day' + (list.length > 1 ? ' multi' : '') + (c.inMonth ? '' : ' out') + (c.date === today ? ' today' : '') + (c.date === selected ? ' sel' : '') + (list.length ? ' has' : '');
          const label = `${weekdayShort(c.date)}, ${shortDate(c.date)}${list.length ? ': ' + list.map(v => typeName(v.shift.shift_type)).join(' and ') + ' shift' + (list.length > 1 ? 's' : '') : ''}`;
          if (mode === 'pick') {
            const tips = list.reduce((a, v) => a + (v.shift.tips ?? 0), 0);
            return (
              <button type="button" key={c.date} class={cls} data-date={c.date} aria-pressed={c.date === selected} aria-label={label} tabIndex={c.date === tabStop ? 0 : -1}
                title={list.length ? `${label}${tips ? ' · ' + moneyWhole(tips) + ' tips' : ''}` : undefined} onClick={() => onPick?.(c.date)}>
                <span class="dn">{n}</span>
                {list.length > 0 && <span class="marks">{list.map(v => <i key={v.shift.id} class={'pill-key k-' + (v.shift.shift_type ?? 'none')}>{letter(v.shift.shift_type)}</i>)}</span>}
                {tips > 0 && <span class="amt">{moneyWhole(tips)}</span>}
              </button>
            );
          }
          return (
            <div key={c.date} class={cls} data-date={c.date}>
              {list.length === 0 ? (
                <button type="button" class="dayhit" onClick={() => onNew?.(c.date)} aria-label={`Log a shift on ${label}`} title={`Log a shift on ${shortDate(c.date)}`}>
                  <span class="dn">{n}</span><Icon name="plus" />
                </button>
              ) : list.map((v, i) => (
                <button type="button" key={v.shift.id} class="sc" aria-label={`Open ${label}`} onClick={() => onOpen?.(v.shift.id)}
                  data-side={scale?.at(v.tph)?.side} style={scale?.at(v.tph) ? { '--heat': String(scale.at(v.tph)!.mag) } : undefined}
                  title={`${typeName(v.shift.shift_type)} · ${moneyWhole(v.shift.tips ?? 0)} tips · ${moneyWhole(v.total)} total`}>
                  <span class="sc-top">
                    {i === 0 && <span class="dn">{n}</span>}
                    <span class="sc-tags"><TypeIcon type={v.shift.shift_type} />{v.shift.party && <PartyIcon />}</span>
                  </span>
                  <strong class="sc-total">{moneyWhole(v.total)}</strong>
                  <span class="sc-sub">{v.tph != null && <b>{perHourWhole(v.tph)}</b>}{v.tph != null && v.hours ? ' · ' : ''}{v.hours ? hours(v.hours) : v.tph == null ? 'no hours' : ''}</span>
                  {v.shift.start != null && v.shift.end != null && <span class="sc-time">{clockShort(v.shift.start)}–{clockShort(v.shift.end)}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div class="calfoot">
        {totals.shifts === 0 ? <p class="muted">Nothing logged in {MONTHS[view.m]} yet.</p>
          : mode === 'pick' ? <Facts items={[{ label: MONTHS[view.m]!, value: `${totals.shifts} shift${totals.shifts === 1 ? '' : 's'}` }, { label: 'Hours', value: hours(totals.hours) }, { label: 'Tips', value: moneyWhole(totals.tips) }]} />
          : <div class="calkpis">
            <MiniStat label="Shifts" value={totals.shifts} pct={pctChange(totals.shifts, before.shifts)} neutral hint="Against last month" />
            <MiniStat label="Hours" value={hours(totals.hours)} pct={pctChange(totals.hours, before.hours)} neutral />
            <MiniStat label="Tips" value={moneyWhole(totals.tips)} pct={pctChange(totals.tips, before.tips)} />
            <MiniStat label="Rate" value={perHour(totals.tph)} pct={pctChange(totals.tph, before.tph)} hint="Tips over hours worked" />
            <MiniStat label="Total" value={moneyWhole(totals.total)} pct={pctChange(totals.total, before.total)} />
          </div>}
      </div>
      {mode === 'browse' && <RateKey scale={scale} />}
      {mode === 'pick' && <ul class="legend calkey">
        {(['day', 'night'] as const).map(t => <li key={t}><i class={'pill-key k-' + t}>{LETTER[t]}</i>{NAME[t]}</li>)}
        <li><i class="key today" />Today</li>
      </ul>}
    </div>
  );
}

/** Previous / next month and jump to today; used by the picker's own head and by the Calendar page's panel head. */
export function MonthNav({ month, onMonth }: { month: Month; onMonth: (m: Month) => void }) {
  const t = todayText();
  const go = (delta: number) => { const d = new Date(Date.UTC(month.y, month.m + delta, 1)); onMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() }); };
  return (
    <div class="calnav">
      <button type="button" class="linkbtn" onClick={() => onMonth({ y: +t.slice(0, 4), m: +t.slice(5, 7) - 1 })}>Jump to today</button>
      <button type="button" class="icon-btn" aria-label="Previous month" onClick={() => go(-1)}><Icon name="left" /></button>
      <button type="button" class="icon-btn" aria-label="Next month" onClick={() => go(1)}><Icon name="chevron" /></button>
    </div>
  );
}

/** What the calendar's shading means: lower rates lean amber, higher lean on the primary colour, the middle is the typical shift. */
export function RateKey({ scale }: { scale: ReturnType<typeof rateScale> }) {
  if (!scale) return null;
  return (
    <div class="ratekey" role="img" aria-label={`Shading is tips per hour. Typical is ${moneyWhole(scale.median)}; lower is amber, higher is the primary colour.`}>
      <span>Tips per hour</span><span class="rk-lo" aria-hidden="true" /><span>lower</span><b>typical {moneyWhole(scale.median)}</b><span>higher</span><span class="rk-hi" aria-hidden="true" />
    </div>
  );
}
