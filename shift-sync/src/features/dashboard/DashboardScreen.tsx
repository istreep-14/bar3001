import { hoursWorked } from '../../core/core.generated.js';
import { signal } from '@preact/signals';
import { liveViews, personById, ready } from '../../data/store.ts';
import { addDays, today } from '../../lib/dates.ts';
import { bestShifts, waiting, weekCompare } from '../../lib/dashboard.ts';
import { STATUS_LABEL, isPending, shiftStatus } from '../../lib/groups.ts';
import { RANK_MIN_HOURS } from '../../lib/stats.ts';
import { dec1, dollars, hours, money, moneyWhole, perHour, shortDate, weekdayShort } from '../../lib/format.ts';
import { go, openForm, openSheet, sheet } from '../../router.ts';
import type { Screen } from '../../router.ts';
import { DeltaPill } from '../../ui/kpi.tsx';
import { Page } from '../../ui/Page.tsx';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { ShiftLog } from '../../parts/ShiftLog.tsx';
import type { LogCol } from '../../parts/ShiftLog.tsx';
import { FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import styles from './DashboardScreen.module.css';

/** The card is narrower than the Log: its list leaves out the two quiet money columns. */
const NARROW: LogCol[] = ['wage', 'other'];

/* Dashboard: this week at a glance, and a door to every other page. The numbers across the top are this week against
 * last week (the same Monday-to-Sunday weeks the Log groups by). Under them, the last two weeks as the Log's own grouped
 * list; beside them this week day by day, your best nights, shifts waiting on tips and who you worked with. Every card is
 * the same part the full page uses and ends in a link to that page. Opening a shift here opens the drawer. */
/** Which week the top strip shows: null = pick for me (this week once it has a shift with money in, else last week). */
const pinned = signal<0 | -1 | null>(null);

export function DashboardScreen() {
  const all = liveViews.value, t = today();
  const auto = weekCompare(all, t).now.shifts > 0 ? 0 : -1;
  const offset = pinned.value ?? auto;
  const w = weekCompare(all, t, offset);
  const recent = all.filter(v => v.shift.date >= addDays(w.start, -7) && v.shift.date <= addDays(w.start, 6));
  const best = bestShifts(all, t);
  const todo = waiting(all);
  const open = sheet.value;

  if (ready.value && all.length === 0) {
    return (
      <Page title="Dashboard" id="dash-title">
        <FirstShiftEmpty>
          This week, your best nights and the crew fill in as you log shifts.
        </FirstShiftEmpty>
      </Page>
    );
  }

  const kpis = [
    { label: 'Tips', value: dollars(w.now.tips), pct: w.delta.tips },
    { label: 'Rate', value: w.now.tph == null ? '—' : money(w.now.tph), pct: w.delta.tph },
    { label: 'Hours', value: hours(w.now.hours), pct: w.delta.hours, neutral: true },
    { label: 'Shifts', value: String(w.now.shifts), pct: null },
    { label: 'Other income', value: dollars(w.now.extra), pct: w.delta.extra },
    { label: 'Total', value: dollars(w.now.total), pct: w.delta.total }
  ];
  const maxH = Math.max(10, ...w.days.map(d => d.hours));
  const bestDay = w.days.filter(d => d.hours).sort((a, b) => b.tips / b.hours - a.tips / a.hours)[0];

  // Who was on this week's shifts: hours only, never money per person.
  // Scheduled shifts (no money in yet) don't count, the same as the figures across the top.
  const crew = new Map<string, { id: string; name: string; you: boolean; shifts: number; hours: number }>();
  for (const d of w.days) for (const v of d.views) if (!isPending(v)) for (const c of v.crew) {
    const p = personById(c.staff_id);
    const row = crew.get(c.staff_id) ?? { id: c.staff_id, name: p?.name ?? c.name ?? '?', you: !!p?.is_user, shifts: 0, hours: 0 };
    row.shifts++; row.hours += hoursWorked(c.start, c.end) ?? 0;
    crew.set(c.staff_id, row);
  }
  const crewRows = [...crew.values()].sort((a, b) => Number(b.you) - Number(a.you) || b.hours - a.hours);

  return (
    <Page title="Dashboard" id="dash-title" tools={
      <>
        <span class="muted num">{shortDate(w.start)} – {shortDate(addDays(w.start, 6))} · {w.partial ? 'so far, against the same days last week' : 'against the week before'}</span>
        <div class="seg" role="radiogroup" aria-label="Week">
          {([[0, 'This week'], [-1, 'Last week']] as const).map(([o, l]) => (
            <label key={o}><input type="radio" name="dash-week" checked={offset === o} onChange={() => { pinned.value = o; }} /><span>{l}</span></label>
          ))}
        </div>
      </>
    }>
      <div class={styles.grid}>
        <div class={styles.main}>
          <dl class={styles.kpis} aria-label={offset === 0 ? 'This week against last week' : 'Last week against the week before'}>
            {kpis.map(k => (
              <div key={k.label} class={styles.kpi}>
                <dt>{k.label}</dt>
                <dd><span class="num">{k.value}</span><DeltaPill pct={k.pct} neutral={k.neutral} /></dd>
              </div>
            ))}
          </dl>

          <Card title="Last two weeks" to="log" link="Open the log">
            <ShiftLog views={recent} by="week" openId={open} inline={false} hidden={NARROW} />
          </Card>
        </div>

        <aside class={styles.side} aria-label="This week">
          <Card title={offset === 0 ? 'This week, day by day' : 'Last week, day by day'} to="calendar" link="Open the calendar">
            <div class={styles.days} role="group" aria-label={offset === 0 ? 'Hours each day this week' : 'Hours each day last week'}>
              {w.days.map(d => {
                const first = d.views.find(v => !isPending(v)) ?? d.views[0], sel = !!first && d.views.some(v => v.shift.id === open);
                const status = !first ? 'no shift' : d.views.every(isPending) ? STATUS_LABEL[shiftStatus(d.views[0]!)].toLowerCase() : `${hours(d.hours)}, ${dollars(d.tips)}`;
                const label = `${weekdayShort(d.date)} ${shortDate(d.date)}: ${status}`;
                return (
                  <button type="button" key={d.date} class={styles.day} aria-label={first ? `${label}. Open` : `${label}. New shift`} aria-pressed={sel}
                    data-empty={first ? undefined : ''} data-pending={first && d.views.every(isPending) ? '' : undefined} data-today={d.date === t ? '' : undefined}
                    onClick={() => (first ? openSheet(first.shift.id) : openForm('new', d.date))}>
                    <span class={styles.capsule} style={{ height: first && d.hours ? `${Math.max(18, (d.hours / maxH) * 100)}%` : undefined }} />
                    <span class={styles.dow}>{weekdayShort(d.date).slice(0, 2)}</span>
                  </button>
                );
              })}
            </div>
            <dl class={styles.list}>
              <div><dt>Hours</dt><dd class="num">{hours(w.now.hours)} <span class="muted">of 40</span></dd></div>
              <div><dt>Best day</dt><dd class="num">{bestDay ? `${weekdayShort(bestDay.date)} · ${perHour(bestDay.tips / bestDay.hours)}` : '—'}</dd></div>
            </dl>
          </Card>

          <Card title="Best nights" sub={`Tips per hour, last 12 weeks, shifts of ${RANK_MIN_HOURS}h or more`} to="overview" link="Open insights">
            {best.length === 0 ? <p class="muted side-note">Nothing in the last 12 weeks yet.</p> : (
              <div class={styles.best}>
                {best.map((v, i) => (
                  <button type="button" key={v.shift.id} class={styles.bestTile} data-top={i === 0 ? '' : undefined} onClick={() => openSheet(v.shift.id)}
                    aria-label={`${weekdayShort(v.shift.date)} ${shortDate(v.shift.date)}, ${money(v.tph)} per hour. Open`}>
                    <span class={`num ${styles.bestRate}`}>{moneyWhole(v.tph!)}</span>
                    <span class={styles.bestDate}>{weekdayShort(v.shift.date)} {shortDate(v.shift.date)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {todo.length > 0 && (
            <Card title="Awaiting tips" to="log" link="Open the log">
              <ul class={styles.todo}>
                {todo.slice(0, 4).map(v => (
                  <li key={v.shift.id}>
                    <span><b>{weekdayShort(v.shift.date)} {shortDate(v.shift.date)}</b><span class="chip" data-kind="pending">{STATUS_LABEL[shiftStatus(v)]}</span></span>
                    <button type="button" class="btn" onClick={() => openForm(v.shift.id)}>Fill in tips</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={offset === 0 ? 'Crew this week' : 'Crew last week'} to="hub/week" link="Open crew week">
            {crewRows.length === 0 ? <p class="muted side-note">No one logged on that week's shifts.</p> : (
              <dl class={styles.list}>
                {crewRows.map(r => <div key={r.id}><dt class={styles.who}><PersonAvatar id={r.id} fallback={r.name} />{r.name}{r.you && <MeBadge />}</dt><dd class="num"><span class="muted">{r.shifts} {r.shifts === 1 ? 'shift' : 'shifts'}</span> {dec1(r.hours)}h</dd></div>)}
              </dl>
            )}
          </Card>
        </aside>
      </div>
    </Page>
  );
}

/** A dashboard card: a heading, the content, and the link to the page it summarises. */
function Card({ title, sub, to, link, children }: { title: string; sub?: string; to: Screen; link: string; children: preact.ComponentChildren }) {
  return (
    <section class={styles.card} aria-label={title}>
      <header class={styles.cardHead}>
        <h3 class={styles.cardTitle}>{title}{sub && <span class={styles.cardSub}>{sub}</span>}</h3>
        <a href={`#/${to}`} class="linkbtn" onClick={e => { e.preventDefault(); go(to); }}>{link}</a>
      </header>
      {children}
    </section>
  );
}
