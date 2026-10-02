import { useState } from 'preact/hooks';
import { liveViews, ready } from '../../data/store.ts';
import { addDays, today as todayText } from '../../lib/dates.ts';
import { dollars, hours, moneyWhole, perHour, shortDate, weekdayShort } from '../../lib/format.ts';
import { STATUS_LABEL, shiftStatus } from '../../lib/groups.ts';
import { tonight } from '../../lib/home.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { weeklySeries } from '../../lib/trends.ts';
import { MiniMonth } from '../../parts/MiniMonth.tsx';
import { Block } from '../../parts/blocks/Block.tsx';
import { Figures, RecentShifts } from '../../parts/blocks/Recent.tsx';
import { WeekAgenda } from '../../parts/blocks/WeekAgenda.tsx';
import { go, openForm, openSheet } from '../../router.ts';
import { ComboChart } from '../../ui/charts.tsx';
import type { ComboDatum } from '../../ui/charts.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import styles from './DashboardScreen.module.css';

/* Home: a short week list, then the chart. One selected shift is shared by the week, the month,
 * the bars and the recent table. Clicking the selected recent row opens the shift. */

const BACK = 21, AHEAD = 7;

function chartShifts(all: ShiftView[], today: string, focus: string | null): ShiftView[] {
  let from = addDays(today, -BACK), to = addDays(today, AHEAD);
  if (focus && (focus < from || focus > to)) { from = addDays(focus, -14); to = addDays(focus, 7); }
  return all.filter(v => v.shift.date >= from && v.shift.date <= to)
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date) || (a.shift.start ?? 0) - (b.shift.start ?? 0));
}

function trailing(rates: (number | null)[], i: number): number | null {
  const slice = rates.slice(Math.max(0, i - 3), i + 1).filter((n): n is number => n != null);
  return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
}

function shiftBars(rows: ShiftView[]): ComboDatum[] {
  const rates = rows.map(v => (shiftStatus(v) === 'done' ? v.tph : null));
  return rows.map((v, i) => {
    const st = shiftStatus(v), done = st === 'done';
    const title = `${weekdayShort(v.shift.date)} ${shortDate(v.shift.date)}`;
    return {
      xlabel: shortDate(v.shift.date),
      title,
      bar: done ? (v.shift.tips ?? 0) : 0,
      line: done ? v.tph : null,
      smooth: trailing(rates, i),
      partial: !done,
      rows: [
        { name: done ? 'Tips' : 'Status', value: done ? dollars(v.shift.tips) : STATUS_LABEL[st], cls: 'k-acc' },
        { name: 'Tips per hour', value: done ? perHour(v.tph) : '—' },
        { name: 'Hours', value: hours(v.hours) },
        ...(v.shift.party ? [{ name: 'Party', value: 'Yes' }] : [])
      ]
    };
  });
}

export function DashboardScreen() {
  const all = liveViews.value, t = todayText();
  const [picked, setPicked] = useState<string | null>(null);
  if (ready.value && all.length === 0) {
    return (
      <section class="panel" aria-label="Home">
        <div class="panel-body"><FirstShiftEmpty>Your week, the last 7 days and how each shift did fill in as you log shifts.</FirstShiftEmpty></div>
      </section>
    );
  }
  const fallback = tonight(all, t).view?.shift.id ?? all.filter(v => shiftStatus(v) === 'done').sort((a, b) => b.shift.date.localeCompare(a.shift.date))[0]?.shift.id ?? null;
  const id = picked && all.some(v => v.shift.id === picked) ? picked : fallback;
  const chosen = all.find(v => v.shift.id === id) ?? null;
  const bars = chartShifts(all, t, chosen?.shift.date ?? null);
  const at = bars.findIndex(v => v.shift.id === id);
  const span = bars.length ? `${shortDate(bars[0]!.shift.date)} – ${shortDate(bars.at(-1)!.shift.date)}` : '';
  const weeks = weeklySeries(all, t, 8);
  const select = (v: ShiftView) => setPicked(v.shift.id);

  return (
    <section class={`panel ${styles.dash}`} aria-label="Home">
      <div class={styles.board}>
        <Block class={styles.span} title="Last 7 days" sub="Against the 7 days before · the line is the last 8 weeks" to="overview" toLabel="Open insights">
          <Figures views={all} today={t} />
        </Block>

        <Block class={`${styles.span} ${styles.hero}`} title="Tips per shift" sub={`${span} · bars are tips, the line is tips per hour. A shift with no tips yet has no bar.`} to="overview" toLabel="Open insights">
          <ComboChart title="Tips per shift" headed={false} wide
            data={shiftBars(bars)} fmtBar={moneyWhole} fmtLine={moneyWhole} barLabel="Tips" lineLabel="Tips per hour" smoothLabel="Recent average"
            rowHead="Shift" height={300} picked={at >= 0 ? at : undefined} onPick={i => { const v = bars[i]; if (v) select(v); }} />
          {chosen && <Readout v={chosen} />}
        </Block>

        <div class={styles.side}>
          <Block title="This week" to="calendar" toLabel="Open the calendar" tools={<>
            <button type="button" class="btn" onClick={() => go('hub/week')}><Icon name="calendar" />Plan week</button>
            <button type="button" class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" />Log shift</button>
          </>}>
            <WeekAgenda views={all} today={t} compact selected={id ?? undefined} onSelect={select} />
          </Block>
          <Block title="Month" to="calendar" toLabel="Open the calendar">
            <MiniMonth views={all} start={chosen?.shift.date.slice(0, 7)} picked={id ?? undefined} onPick={list => {
              const keep = list.find(v => v.shift.id === id);
              const v = keep ?? list[0];
              if (v) select(v);
            }} />
          </Block>
        </div>

        <Block title="Recent shifts" sub="Tips per hour against shifts like each one. Click again to open." to="table" toLabel="Open shifts">
          <RecentShifts views={all} take={6} selected={id ?? undefined} onSelect={select} />
        </Block>

        <Block class={styles.span} title="Tips by week" sub="Bars are tips. The line is tips per hour, and the smooth line is the 4-week average." to="overview" toLabel="Open insights">
          <ComboChart title="Tips by week" headed={false} height={180}
            fmtBar={moneyWhole} fmtLine={moneyWhole} barLabel="Tips" lineLabel="Tips per hour" smoothLabel="4-week average"
            data={weeks.map(p => ({
              xlabel: shortDate(p.key),
              title: `Week of ${shortDate(p.key)}${p.partial ? ' (so far)' : ''}`,
              bar: p.tips, line: p.tph, smooth: p.smooth, partial: p.partial,
              rows: [
                { name: 'Tips', value: dollars(p.tips), cls: 'k-acc' },
                { name: 'Tips per hour', value: perHour(p.tph) },
                { name: '4-week average', value: perHour(p.smooth) },
                { name: 'Hours', value: hours(p.hours) }
              ]
            }))} />
        </Block>
      </div>
    </section>
  );
}

function Readout({ v }: { v: ShiftView }) {
  const st = shiftStatus(v);
  const when = `${weekdayShort(v.shift.date)} ${shortDate(v.shift.date)}`;
  const line = st === 'done'
    ? `${when} · ${dollars(v.shift.tips)} tips · ${perHour(v.tph)}`
    : st === 'worked'
      ? `${when} · needs its tips`
      : `${when} · ${STATUS_LABEL[st]}`;
  return (
    <p class={styles.readout}>
      <span>{line}{v.shift.party ? ' · Party' : ''}</span>
      {st === 'worked'
        ? <button type="button" class="btn btn-primary" onClick={() => openForm(v.shift.id)}>Fill in tips</button>
        : <button type="button" class="btn" onClick={() => openSheet(v.shift.id)}>Open shift</button>}
    </p>
  );
}
