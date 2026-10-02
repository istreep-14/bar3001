import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { hoursWorked } from '../../core/core.generated.js';
import { personById } from '../../data/store.ts';
import { SOURCE_NAME, bySource, sourcesIn, weekAgenda, weekPeople } from '../../lib/blocks.ts';
import type { AgendaDay, IncomeWeek, Source } from '../../lib/blocks.ts';
import { daysBetween } from '../../lib/dates.ts';
import { clockPlain, clockShort, dec1, dollars, hours, moneyWhole, perHourWhole, shortDate, weekShort } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import { CrewStack } from '../CrewStack.tsx';
import { PersonAvatar } from '../PersonAvatar.tsx';
import s from './WeekCards.module.css';

/* The week as a horizontal strip: seven squarish cards, Monday to Sunday, each with the one thing that matters about its
 * day — a day still to come leads with its start time, a day worked with what it paid, a day waiting on tips asks for
 * them, a day off is a hatched square that adds a shift. Today is the dark card.
 *
 * Under the cards, optional rows line up with them, one cell per day, so a fact reads across the week:
 *   time      start – end
 *   hours     hours worked
 *   money     tips and the rate
 *   sources   that day's money as a small stacked bar by source
 *   crew      everyone on, listed down the day: face, name, their own hours
 *   people    one row per bartender that week (you first), their times in each day's column, their week's hours
 * `expandable` adds a Details switch that shows or hides the rows; a page that wants the choice remembered passes `open`
 * and `onOpen` (parts don't keep storage of their own). */
export type RowKind = 'time' | 'hours' | 'money' | 'sources' | 'crew' | 'people';

export function WeekCards({ views, today, rows = [], expandable = false, open: shownOpen, onOpen, offset: shown, onOffset, nav = true, expect, tools }: {
  views: ShiftView[];
  today: string;
  /** What a booked shift should bring (tips, low to high), shown faintly on its card; null when there's too little to go on. */
  expect?: (v: ShiftView) => { lo: number; hi: number } | null;
  /** Buttons at the end of the strip's bar (Plan week, Log shift). */
  tools?: ComponentChildren;
  rows?: RowKind[];
  expandable?: boolean;
  /** With `expandable`: whether the rows show (the page's remembered choice); without `onOpen`, only where it starts. */
  open?: boolean;
  onOpen?: (open: boolean) => void;
  /** Weeks from this one, when the page steps the week itself; otherwise the strip's own arrows. */
  offset?: number;
  onOffset?: (n: number) => void;
  nav?: boolean;
}) {
  const [own, setOwn] = useState(0);
  const offset = shown ?? own, step = (n: number) => (onOffset ? onOffset(offset + n) : setOwn(offset + n));
  const [ownOpen, setOwnOpen] = useState(!!shownOpen);
  const isOpen = onOpen ? !!shownOpen : ownOpen, setOpen = onOpen ?? setOwnOpen;
  const showRows = rows.length > 0 && (!expandable || isOpen);
  const days = weekAgenda(views, today, offset);
  const start = days[0]!.date;
  const sum = summarize(days.flatMap(d => d.views));
  // a strip narrower than its seven cards opens with today (or the week's first day still to come) in view
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current, card = el?.querySelector<HTMLElement>('[data-tone^="today"]');
    if (el && card && el.scrollWidth > el.clientWidth) el.scrollLeft += card.getBoundingClientRect().left - el.getBoundingClientRect().left - (showRows ? 96 : 8);
  }, [offset, showRows]);
  const name = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : weekShort(start);
  return (
    <div class={s.wrap}>
      {(nav || expandable || tools) && (
        <div class={s.bar}>
          {nav && (
            <div class={s.nav}>
              <button type="button" class={s.step} aria-label="Previous week" onClick={() => step(-1)}><Icon name="left" /></button>
              <span class={s.navName} aria-live="polite"><b>{name}</b><small>{weekShort(start)}</small></span>
              <button type="button" class={s.step} aria-label="Next week" onClick={() => step(1)}><Icon name="chevron" /></button>
            </div>
          )}
          {!showRows && <span class={s.sum}><b>{dollars(sum.tips)}</b> tips · <b>{hours(sum.hours)}</b> · <b>{perHourWhole(sum.tph)}</b></span>}
          {expandable && rows.length > 0 && (
            <button type="button" class={s.toggle} aria-expanded={showRows} onClick={() => setOpen(!showRows)}>
              {showRows ? 'Hide details' : 'Details'}<Icon name={showRows ? 'up' : 'down'} />
            </button>
          )}
          {tools && <span class={s.tools}>{tools}</span>}
        </div>
      )}
      <div class={s.scroll} ref={scroller}>
        <div class={s.grid} data-rows={showRows ? '' : undefined} role="table" aria-label={`Week of ${shortDate(start)}`}>
          <div class={s.row} role="row">
            {showRows && (
              <dl class={s.corner} role="columnheader" aria-label="The week">
                <div><dt>Tips</dt><dd>{dollars(sum.tips)}</dd></div>
                <div><dt>Hours</dt><dd>{hours(sum.hours)}</dd></div>
                <div><dt>Rate</dt><dd>{perHourWhole(sum.tph)}</dd></div>
              </dl>
            )}
            {days.map(d => <DayCard key={d.date} day={d} today={today} expect={expect} />)}
          </div>
          {showRows && rows.map(r => r === 'people'
            ? <PeopleRows key={r} days={days} />
            : <Row key={r} kind={r} days={days} />)}
        </div>
      </div>
    </div>
  );
}

const wdOf = (date: string) => new Date(date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
const relDay = (date: string, today: string) => {
  const n = daysBetween(today, date);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `In ${n} days` : null;
};

function DayCard({ day, today, expect }: { day: AgendaDay; today: string; expect?: (v: ShiftView) => { lo: number; hi: number } | null }) {
  const wd = wdOf(day.date), n = +day.date.slice(8), v = day.views[0];
  const head = <span class={s.cHead}><span class={s.cWd}>{wd}</span><span class={s.cDay}>{n}</span></span>;
  if (!v) {
    return (
      <div role="cell" class={s.cell}>
        <button type="button" class={s.card} data-tone={day.when === 'today' ? 'today-off' : 'off'} onClick={() => openForm('new', day.date)}
          aria-label={`${wd} ${shortDate(day.date)}: off. Add a shift`}>
          {head}
          <span class={s.cOff}>{day.when === 'past' ? 'Off' : 'Free'}</span>
          <span class={s.cAdd}><Icon name="plus" />Add</span>
        </button>
      </div>
    );
  }
  const st = shiftStatus(v), more = day.views.length - 1;
  const tone = day.when === 'today' ? 'today' : st;
  const sumDay = summarize(day.views);
  const guess = st === 'scheduled' && expect ? expect(v) : null;
  const type = v.shift.shift_type && <span class={s.cType} data-type={v.shift.shift_type}><Icon name={v.shift.shift_type === 'day' ? 'sun' : 'moon'} /></span>;
  return (
    <div role="cell" class={s.cell}>
      <button type="button" class={s.card} data-tone={tone} aria-pressed={day.views.some(x => x.shift.id === sheet.value)}
        onClick={() => (st === 'worked' ? openForm(v.shift.id) : openSheet(v.shift.id))}
        aria-label={`${wd} ${shortDate(day.date)}: ${st === 'scheduled' ? `starts ${clockPlain(v.shift.start) || 'at a time not set'}${guess ? `, usually ${moneyWhole(guess.lo)} to ${moneyWhole(guess.hi)} in tips` : ''}` : st === 'worked' ? 'waiting on tips' : `${dollars(sumDay.tips)} tips, ${perHourWhole(sumDay.tph)}`}. Open`}>
        <span class={s.cTop}>{head}{type}</span>
        {v.crew.length > 0 && <span class={s.cCrew}><CrewStack crew={day.views.flatMap(x => x.crew)} max={4} sm /></span>}
        {st === 'scheduled' ? (
          <>
            <span class={s.cMain}>{v.shift.start != null ? clockShort(v.shift.start) : '—'}</span>
            <span class={s.cFoot}>{relDay(day.date, today) ?? 'Booked'}{v.crew.length ? ` · ${v.crew.length} on` : ''}</span>
            {guess && <span class={s.cGuess} title="The middle half of what shifts like this one brought in tips">~{moneyWhole(guess.lo)}–{moneyWhole(guess.hi)}</span>}
          </>
        ) : st === 'worked' ? (
          <>
            <span class={s.cMain}>Tips?</span>
            <span class={s.cFoot}>{hours(v.hours)} · fill in</span>
          </>
        ) : (
          <>
            <span class={s.cMain}>{dollars(sumDay.tips)}</span>
            <span class={s.cFoot}><span class={s.cRate}>{perHourWhole(sumDay.tph)}</span>{hours(sumDay.hours)}</span>
          </>
        )}
        {more > 0 && <span class={s.cMore}>+{more}</span>}
      </button>
    </div>
  );
}

const ROW_LABEL: Record<Exclude<RowKind, 'people'>, string> = { time: 'Time', hours: 'Hours', money: 'Tips', sources: 'Income', crew: 'Crew' };

function Row({ kind, days }: { kind: Exclude<RowKind, 'people'>; days: AgendaDay[] }) {
  const srcs: Source[] = kind === 'sources' ? sourcesIn(days.map(d => ({ by: bySource(d.views) }) as IncomeWeek)) : [];
  const max = kind === 'sources' ? Math.max(1, ...days.map(d => Object.values(bySource(d.views)).reduce((t, n) => t + (n ?? 0), 0))) : 1;
  return (
    <div class={s.row} data-kind={kind} role="row">
      <span class={s.label} role="rowheader">{ROW_LABEL[kind]}</span>
      {days.map(d => <span key={d.date} class={s.rcell} role="cell">{cellFor(kind, d, srcs, max)}</span>)}
    </div>
  );
}

const nil = <span class={s.nil}>—</span>;
function cellFor(kind: Exclude<RowKind, 'people'>, d: AgendaDay, srcs: Source[], max: number): ComponentChildren {
  if (!d.views.length) return nil;
  if (kind === 'time') return <span class={s.stackList}>{d.views.map(v => <span key={v.shift.id}>{clockShort(v.shift.start) || '—'}{v.shift.end != null ? `–${clockShort(v.shift.end)}` : ''}</span>)}</span>;
  const sum = summarize(d.views);
  if (kind === 'hours') return sum.hours ? <b>{dec1(sum.hours)}<small>h</small></b> : d.views.some(v => v.hours) ? <b>{dec1(d.views.reduce((t, v) => t + (v.hours ?? 0), 0))}<small>h</small></b> : nil;
  if (kind === 'money') return sum.shifts ? <span class={s.money}><b>{moneyWhole(sum.tips)}</b><small>{perHourWhole(sum.tph)}</small></span> : nil;
  if (kind === 'sources') {
    const by = bySource(d.views), total = Object.values(by).reduce((t, n) => t + (n ?? 0), 0);
    if (!total) return nil;
    return (
      <span class={s.src} title={srcs.filter(x => by[x]).map(x => `${SOURCE_NAME[x]} ${moneyWhole(by[x]!)}`).join(' · ')}>
        <span class={s.srcBar} style={{ width: (total / max) * 100 + '%' }}>{srcs.map(x => by[x] ? <i key={x} data-src={x} style={{ flexGrow: by[x] }} /> : null)}</span>
        <small>{moneyWhole(total)}</small>
      </span>
    );
  }
  // crew: everyone on, down the day
  const crew = d.views.flatMap(v => v.crew);
  if (!crew.length) return nil;
  return (
    <ul class={s.crew}>
      {crew.map(c => {
        const p = personById(c.staff_id), h = hoursWorked(c.start, c.end);
        return (
          <li key={c.id}>
            <PersonAvatar id={c.staff_id} fallback={c.name} />
            <span class={s.crewName}>{p?.name ?? c.name ?? '?'}{p?.is_user && <MeBadge />}</span>
            <small>{h != null ? `${dec1(h)}h` : clockShort(c.start)}</small>
          </li>
        );
      })}
    </ul>
  );
}

/* one row per bartender that week, their own times in each day's column: the roster under the strip */
function PeopleRows({ days }: { days: AgendaDay[] }) {
  const people = weekPeople(days, id => !!personById(id)?.is_user, hoursWorked);
  if (!people.length) return <div class={s.row} role="row"><span class={s.label} role="rowheader">People</span><span class={s.rcell} data-span="" role="cell">{nil}</span></div>;
  return (
    <>
      <div class={s.row} data-kind="people-head" role="row">
        <span class={s.label} role="rowheader">People · {people.length}</span>
      </div>
      {people.map(p => {
        const who = personById(p.id);
        return (
          <div key={p.id} class={s.row} data-kind="person" data-you={p.you ? '' : undefined} role="row">
            <span class={s.label} role="rowheader">
              <PersonAvatar id={p.id} fallback={p.name} />
              <span class={s.personName}>{who?.name ?? p.name ?? '?'}</span>
              <small>{p.hours ? `${dec1(p.hours)}h` : `${p.days.length} booked`}</small>
            </span>
            {days.map(d => {
              const on = p.days.filter(x => x.date === d.date);
              return (
                <span key={d.date} class={s.rcell} role="cell">
                  {on.length ? on.map((x, i) => (
                    <span key={i} class={s.slot} data-when={d.when} title={x.location ?? undefined}>
                      {clockShort(x.start) || '—'}{x.end != null ? `–${clockShort(x.end)}` : ''}
                      {x.location && <i class={s.station}>{x.location}</i>}
                    </span>
                  )) : <span class={s.slotOff} aria-label="off" />}
                </span>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
