import { useState } from 'preact/hooks';
import { weekAgenda } from '../../lib/blocks.ts';
import type { AgendaDay } from '../../lib/blocks.ts';
import { daysBetween } from '../../lib/dates.ts';
import { clockPlain, clockShort, dollars, hours, perHourWhole, shortDate, weekShort } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import { CrewStack } from '../CrewStack.tsx';
import s from './blocks.module.css';

/* The week as seven rows, one column: Monday at the top, each day a card beside its date on a rail. A day still to come
 * leads with its start time (that is what you need to know about it); a day gone leads with what it paid, then its rate
 * and hours; a day off is a thin hatched strip you can tap to add a shift. Today is the dark card. Arrows step a week. */
export function WeekAgenda({ views, today, offset: shown, onOffset, nav = true, compact = false, selected, onSelect }: {
  views: ShiftView[]; today: string;
  /** Weeks from this one, when the page steps the week itself (the Calendar's week view); otherwise the agenda's own. */
  offset?: number; onOffset?: (n: number) => void;
  /** Show the agenda's own week arrows. */
  nav?: boolean;
  /** Short rows for a side list: no week totals under the days. */
  compact?: boolean;
  /** The shift this list shares with a chart and a calendar. Clicking a row selects it instead of opening it. */
  selected?: string;
  onSelect?: (v: ShiftView) => void;
}) {
  const [own, setOwn] = useState(0);
  const offset = shown ?? own, setOffset = (f: (n: number) => number) => (onOffset ? onOffset(f(offset)) : setOwn(f));
  const days = weekAgenda(views, today, offset);
  const start = days[0]!.date;
  return (
    <div class={s.agendaWrap} data-compact={compact ? '' : undefined}>
      {nav && <div class={s.weekNav}>
        <button type="button" class={s.step} aria-label="Previous week" onClick={() => setOffset(o => o - 1)}><Icon name="left" /></button>
        <span class={s.weekName} aria-live="polite">{offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : weekShort(start)}<small>{weekShort(start)}</small></span>
        <button type="button" class={s.step} aria-label="Next week" onClick={() => setOffset(o => o + 1)}><Icon name="chevron" /></button>
      </div>}
      <ol class={s.agenda} aria-label={`Week of ${shortDate(start)}`}>
        {days.map(d => <AgendaRow key={d.date} day={d} today={today} selected={selected} onSelect={onSelect} />)}
      </ol>
      {(() => {
        const all = days.flatMap(d => d.views), sum = summarize(all), ahead = all.filter(v => shiftStatus(v) === 'scheduled').length;
        return (
          <dl class={s.weekSum}>
            <div><dt>Tips</dt><dd>{dollars(sum.tips)}</dd></div>
            <div><dt>Hours</dt><dd>{hours(sum.hours)}</dd></div>
            <div><dt>{ahead ? 'Still to come' : 'Rate'}</dt><dd>{ahead ? `${ahead} shift${ahead === 1 ? '' : 's'}` : perHourWhole(sum.tph)}</dd></div>
          </dl>
        );
      })()}
    </div>
  );
}

function AgendaRow({ day, today, selected, onSelect }: { day: AgendaDay; today: string; selected?: string; onSelect?: (v: ShiftView) => void }) {
  const wd = new Date(day.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
  const first = day.views[0];
  return (
    <li class={s.aRow} data-when={day.when} data-off={first ? undefined : ''}>
      <div class={s.rail} aria-hidden="true">
        <span class={s.railWd}>{wd}</span>
        <span class={s.railDay}>{+day.date.slice(8)}</span>
      </div>
      <div class={s.aCards}>
        {first ? day.views.map(v => <AgendaCard key={v.shift.id} v={v} day={day} today={today} wd={wd} selected={selected} onSelect={onSelect} />) : (
          <button type="button" class={s.aOff} onClick={() => openForm('new', day.date)} aria-label={`${wd} ${shortDate(day.date)}: off. Add a shift`}>
            <span>{day.when === 'past' ? 'Off' : 'Nothing booked'}</span><span class={s.aAdd}><Icon name="plus" />Add</span>
          </button>
        )}
      </div>
    </li>
  );
}

const relDay = (date: string, today: string) => {
  const n = daysBetween(today, date);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `In ${n} days` : null;
};

function AgendaCard({ v, day, today, wd, selected, onSelect }: {
  v: ShiftView; day: AgendaDay; today: string; wd: string; selected?: string; onSelect?: (v: ShiftView) => void;
}) {
  const status = shiftStatus(v), type = v.shift.shift_type;
  const span = v.shift.start != null ? `${clockShort(v.shift.start)}${v.shift.end != null ? ' – ' + clockShort(v.shift.end) : ''}` : 'No times yet';
  const open = onSelect ? selected === v.shift.id : sheet.value === v.shift.id;
  const choose = onSelect ? () => onSelect(v) : null;
  const tone = day.when === 'today' ? 'inverse' : status === 'scheduled' ? 'ahead' : status === 'worked' ? 'waiting' : 'done';
  const typeTag = type && <span class={s.aType} data-type={type}><Icon name={type === 'day' ? 'sun' : 'moon'} />{type === 'day' ? 'Day' : 'Night'}</span>;
  if (status === 'scheduled') {
    return (
      <button type="button" class={s.aCard} data-tone={tone} aria-pressed={open} onClick={choose ?? (() => openSheet(v.shift.id))}
        aria-label={`${wd} ${shortDate(v.shift.date)}: starts ${clockPlain(v.shift.start) || 'at a time not set'}. ${choose ? 'Select' : 'Open'}`}>
        <span class={s.aMain}>
          <span class={s.aStart}>{v.shift.start != null ? clockPlain(v.shift.start) : '—'}</span>
          <span class={s.aMeta}>{typeTag}<span>{relDay(v.shift.date, today) ?? 'Upcoming'}</span></span>
        </span>
        {v.crew.length > 0 && <span class={s.aCrew}><CrewStack crew={v.crew} max={3} sm /></span>}
      </button>
    );
  }
  if (status === 'worked') {
    return (
      <button type="button" class={s.aCard} data-tone={tone} aria-pressed={open} onClick={choose ?? (() => openForm(v.shift.id))} aria-label={`${wd} ${shortDate(v.shift.date)}: waiting on tips. ${choose ? 'Select' : 'Fill them in'}`}>
        <span class={s.aMain}>
          <span class={s.aFig}>Tips?</span>
          <span class={s.aMeta}>{typeTag}<span>{span} · {hours(v.hours)}</span></span>
        </span>
        <span class={s.aCta}>Fill in</span>
      </button>
    );
  }
  return (
    <button type="button" class={s.aCard} data-tone={tone} aria-pressed={open} onClick={choose ?? (() => openSheet(v.shift.id))}
      aria-label={`${wd} ${shortDate(v.shift.date)}: ${dollars(v.shift.tips)} tips, ${perHourWhole(v.tph)}, ${hours(v.hours)}. ${choose ? 'Select' : 'Open'}`}>
      <span class={s.aMain}>
        <span class={s.aFig}>{dollars(v.shift.tips)}</span>
        <span class={s.aMeta}>{typeTag}<span>{span}</span></span>
      </span>
      <span class={s.aSide}>
        <span class={s.aRate}>{perHourWhole(v.tph)}</span>
        <span class={s.aHours}>{hours(v.hours)}</span>
      </span>
    </button>
  );
}
