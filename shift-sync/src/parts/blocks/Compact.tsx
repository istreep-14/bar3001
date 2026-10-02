import { Fragment } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { dailyValues, levelScale, weekColumns } from '../../lib/blocks.ts';
import type { DayMetric, DayValue } from '../../lib/blocks.ts';
import { addDays } from '../../lib/dates.ts';
import { MONTH_SHORT, WEEKDAY_SHORT, clockShort, dec1, moneyWhole, perHourWhole, shortDate } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import s from './Compact.module.css';

/* The compact calendars: as little room as a row of chips or a block of squares, one value a day.
 *   DayChips    a run of small date tiles (two-digit day over its weekday, a figure under it), today lifted; the
 *               strip scrolls to keep today in view. The most minified week strip.
 *   DayHeatmap  GitHub-style: a column a week, a row a weekday, each day a square shaded by quartile; months along the
 *               top, a Less → More key. Shows months of tips (or rate, hours) in one block.
 * Tap a day with a shift to open it, an empty day to start one there. Shading is by the quartiles of the days in view,
 * so one big night doesn't wash out the rest. */

const fmtOf = (m: DayMetric) => (v: number) => (m === 'rate' ? perHourWhole(v) : m === 'hours' ? `${dec1(v)}h` : moneyWhole(v));
const NOUN: Record<DayMetric, string> = { tips: 'tips', rate: 'tips per hour', hours: 'hours', total: 'total' };
const open = (d: DayValue) => {
  const first = d.views.find(v => v.shift.id === sheet.value) ?? d.views[0];
  if (!first) openForm('new', d.date);
  else if (shiftStatus(first) === 'worked') openForm(first.shift.id);
  else openSheet(first.shift.id);
};
const says = (d: DayValue, m: DayMetric) => {
  const when = `${WEEKDAY_SHORT[(new Date(d.date + 'T12:00').getDay() + 6) % 7]} ${shortDate(d.date)}`;
  if (d.value != null) return `${when}: ${fmtOf(m)(d.value)} ${m === 'rate' ? '' : NOUN[m]}`.trim();
  if (!d.n) return `${when}: no shift`;
  const st = shiftStatus(d.views[0]!);
  return `${when}: ${st === 'worked' ? 'waiting on tips' : `starts ${clockShort(d.views[0]!.shift.start) || 'at a time not set'}`}`;
};

export function DayChips({ views, today, back = 13, ahead = 6, metric = 'tips' }: {
  views: ShiftView[]; today: string;
  /** Days before today, and after it. */
  back?: number; ahead?: number;
  metric?: DayMetric;
}) {
  const days = dailyValues(views, addDays(today, -back), addDays(today, ahead), metric);
  const lv = levelScale(days.map(d => d.value)), fmt = fmtOf(metric);
  const row = useRef<HTMLDivElement>(null);
  // keep today in view: scroll it to the strip's right third on first draw
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[data-today]');
    if (el && row.current) row.current.scrollLeft = el.offsetLeft - row.current.clientWidth * 0.62;
  }, [today]);
  return (
    <div class={s.chips} ref={row} role="group" aria-label={`Days around today, ${NOUN[metric]}`}>
      {days.map(d => {
        const wd = WEEKDAY_SHORT[(new Date(d.date + 'T12:00').getDay() + 6) % 7]!;
        const first = d.views[0], st = first ? shiftStatus(first) : null;
        const fig = d.value != null ? fmt(d.value) : st === 'scheduled' ? clockShort(first!.shift.start) || '•' : st === 'worked' ? '?' : '';
        return (
          <button type="button" key={d.date} class={s.chip} data-today={d.date === today ? '' : undefined} data-lv={lv(d.value)}
            data-state={st ?? 'off'} data-future={d.date > today ? '' : undefined} aria-pressed={d.views.some(v => v.shift.id === sheet.value)}
            aria-label={`${says(d, metric)}. ${d.n ? 'Open' : 'Add a shift'}`} onClick={() => open(d)}>
            <span class={s.cn}>{d.date.slice(8)}</span>
            <span class={s.cw}>{wd}</span>
            <span class={s.cf}>{fig}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DayHeatmap({ views, today, weeks = 26, metric = 'tips' }: { views: ShiftView[]; today: string; weeks?: number; metric?: DayMetric }) {
  const cols = weekColumns(today, weeks);
  const days = dailyValues(views, cols[0]!, addDays(cols[cols.length - 1]!, 6), metric);
  const by = new Map(days.map(d => [d.date, d]));
  const lv = levelScale(days.filter(d => d.date <= today).map(d => d.value));
  const fmt = fmtOf(metric);
  const shown = days.filter(d => d.value != null);
  const total = metric === 'tips' || metric === 'total' || metric === 'hours' ? shown.reduce((t, d) => t + d.value!, 0) : null;
  const best = shown.reduce<DayValue | null>((b, d) => (!b || d.value! > b.value! ? d : b), null);
  return (
    <figure class={s.heat} role="group" aria-label={`${NOUN[metric]} by day, last ${weeks} weeks`}>
      <div class={s.hScroll}>
        <div class={s.hGrid} style={{ '--weeks': cols.length }}>
          <span />
          {cols.map((c, i) => {
            const m = +addDays(c, 6).slice(5, 7) - 1, newMonth = i === 0 || +addDays(cols[i - 1]!, 6).slice(5, 7) - 1 !== m;
            return <span key={c} class={s.hMonth} aria-hidden="true">{newMonth && i < cols.length - 1 ? MONTH_SHORT[m] : ''}</span>;
          })}
          {WEEKDAY_SHORT.map((w, r) => (
            <Fragment key={'r' + r}>
              <span class={s.hWd} aria-hidden="true">{r % 2 === 0 ? w : ''}</span>
              {cols.map(c => {
                const date = addDays(c, r), d = by.get(date)!;
                if (date > today && !d.n) return <i key={date} class={s.hCell} data-lv="future" />;
                const tip = says(d, metric);
                return (
                  <button type="button" key={date} class={`${s.hCell} tip`} data-tip={tip} data-lv={d.value == null && d.n ? 'pending' : lv(d.value)}
                    data-today={date === today ? '' : undefined} aria-label={`${tip}. ${d.n ? 'Open' : 'Add a shift'}`} onClick={() => open(d)} />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <figcaption class={s.hFoot}>
        <span class={s.hSum}>
          {total != null && <><b>{fmt(total)}</b> {NOUN[metric]} · </>}
          <b>{shown.length}</b> days worked{best && <> · best <b>{fmt(best.value!)}</b> {shortDate(best.date)}</>}
        </span>
        <span class={s.hKey} aria-hidden="true">Less<i data-lv="0" /><i data-lv="1" /><i data-lv="2" /><i data-lv="3" /><i data-lv="4" />More</span>
      </figcaption>
    </figure>
  );
}
