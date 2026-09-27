import { signal } from '@preact/signals';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { sheetProblems, state, syncMessage } from '../../data/sync.ts';
import { addDays } from '../../lib/dates.ts';
import { dec1, hours, moneyWhole, shortDate, weekdayShort } from '../../lib/format.ts';
import { mondayOf } from '../../lib/periods.ts';
import { byRecent, summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { inRange, pctChange } from '../../lib/trends.ts';
import { clockShort } from '../../lib/format.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import { PartyIcon, TypeIcon } from '../../ui/Badges.tsx';
import { DateCell } from '../../ui/DateCell.tsx';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { DeltaPill, Meter, MiniStat } from '../../ui/kpi.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import styles from './JournalScreen.module.css';

/* Journal: the relaxed way through the same shifts. One roomy row per shift instead of a grid of numbers: the date, what it was
 * (when, who was on, the note), and what it made with its rate set against your own average. Weeks carry their own small KPIs.
 * Same period control and the same drawer as the Log. Rate is tips over hours. */
const PAGE = 60;
const shown = signal(PAGE);

const crewLine = (v: ShiftView): string => {
  const names = v.crew.map(c => ({ me: personById(c.staff_id)?.is_user, name: personById(c.staff_id)?.name ?? c.name })).filter(c => !c.me && c.name).map(c => c.name!);
  return names.length === 0 ? '' : names.length <= 3 ? `with ${names.join(', ')}` : `with ${names.slice(0, 3).join(', ')} +${names.length - 3}`;
};

export function JournalScreen() {
  const all = liveViews.value, views = scopedViews(all).sort(byRecent);
  const s = summarize(views), selected = sheet.value;
  const best = Math.max(0, ...views.map(v => v.tph ?? 0));
  const page = views.slice(0, shown.value);

  // weeks, newest first
  const weeks: { key: string; views: ShiftView[] }[] = [];
  for (const v of page) {
    const k = mondayOf(v.shift.date), last = weeks[weeks.length - 1];
    if (last && last.key === k) last.views.push(v); else weeks.push({ key: k, views: [v] });
  }

  return (
    <section class="panel" aria-labelledby="jr-title">
      <PanelHead title="Journal" id="jr-title"><ScopeControl /></PanelHead>
      <div class={`panel-body ${styles.body}`}>
        {state.value === 'failed' && <div class={styles.banner} role="alert"><Icon name="alert" /><span>{syncMessage.value || 'Sync failed.'} Your shifts are saved on this device.</span></div>}
        {sheetProblems.value.length > 0 && <div class={styles.banner} role="alert"><Icon name="alert" /><span>Fix these in the Sheet, then sync again: {sheetProblems.value.join(' ')}</span></div>}
        {ready.value && all.length === 0 ? (
          <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> Add shift</button>}>
            Add the date, hours and tips. Everything saves on this device first, so it works with no signal.
          </EmptyState>
        ) : ready.value && views.length === 0 ? (
          <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>
        ) : (
          <>
            <div class={styles.summary}>
              <MiniStat label="Shifts" value={s.shifts} /><MiniStat label="Hours" value={hours(s.hours)} />
              <MiniStat label="Tips" value={moneyWhole(s.tips)} /><MiniStat label="Rate" value={s.tph == null ? '—' : `$${s.tph.toFixed(1)}/hr`} hint="Tips over hours worked" />
              <MiniStat label="Total" value={moneyWhole(s.total)} />
            </div>
            {weeks.map(w => {
              const wk = summarize(inRange(all, w.key, addDays(w.key, 6))), before = summarize(inRange(all, addDays(w.key, -7), addDays(w.key, -1)));
              return (
                <section key={w.key} class={styles.week} aria-label={`Week of ${shortDate(w.key)}`}>
                  <header class={styles.weekHead}>
                    <h3>{shortDate(w.key)} – {shortDate(addDays(w.key, 6))}</h3>
                    <span class={styles.weekStats}>
                      <MiniStat label="Total" value={moneyWhole(wk.total)} pct={pctChange(wk.total, before.total)} hint="Against the week before" />
                      <MiniStat label="Rate" value={wk.tph == null ? '—' : `$${wk.tph.toFixed(1)}/hr`} pct={pctChange(wk.tph, before.tph)} />
                      <span class={styles.hoursMeter}><span class="mk">{hours(wk.hours)} of 40h</span><Meter value={wk.hours} max={40} label={`${hours(wk.hours)} worked of a 40-hour week`} /></span>
                    </span>
                  </header>
                  <ul class={styles.list}>
                    {w.views.map(v => <Row key={v.shift.id} v={v} avg={s.tph} best={best} selected={selected === v.shift.id} />)}
                  </ul>
                </section>
              );
            })}
            {views.length > shown.value && <button class="btn btn-quiet" onClick={() => { shown.value += PAGE; }}>Show more ({views.length - shown.value} older)</button>}
          </>
        )}
      </div>
    </section>
  );
}

function Row({ v, avg, best, selected }: { v: ShiftView; avg: number | null; best: number; selected: boolean }) {
  const sh = v.shift, crew = crewLine(v), pct = pctChange(v.tph, avg);
  return (
    <li>
      <button type="button" class={styles.row} aria-current={selected ? 'true' : undefined} onClick={() => openSheet(sh.id)}>
        <span class={styles.date}><small>{weekdayShort(sh.date)}</small><b><DateCell d={sh.date} banded /></b></span>
        <span class={styles.what}>
          <span class={styles.line}>
            <TypeIcon type={sh.shift_type} />{sh.party && <PartyIcon />}
            <span class="num">{sh.start != null && sh.end != null ? `${clockShort(sh.start)} – ${clockShort(sh.end)}` : 'No times'}{v.hours != null && ` · ${hours(v.hours)}`}</span>
          </span>
          {crew && <span class={styles.sub}>{crew}</span>}
          {sh.notes && <span class={`${styles.sub} ${styles.note}`}>{sh.notes}</span>}
        </span>
        <span class={styles.figs}>
          <b class={styles.total}>{moneyWhole(v.total)}</b>
          <span class={styles.rate}>{v.tph == null ? 'no rate' : <><span><b>${dec1(v.tph)}</b>/hr tips</span><DeltaPill pct={pct} /></>}</span>
          <Meter value={v.tph} max={best} label={v.tph == null ? '' : `$${dec1(v.tph)} an hour in tips, against your best shift of $${dec1(best)}`} />
        </span>
      </button>
    </li>
  );
}
