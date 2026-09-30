import { signal } from '@preact/signals';
import { oneOf, persisted } from '../../data/persisted.ts';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { sheetProblems, state, syncMessage } from '../../data/sync.ts';
import { DASH, dollars } from '../../lib/format.ts';
import { GROUP_BYS, groupShifts } from '../../lib/groups.ts';
import type { GroupBy } from '../../lib/groups.ts';
import { rateContext, summarize } from '../../lib/stats.ts';
import { sheet } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import { Page } from '../../ui/Page.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import { ShiftCard } from './ShiftCard.tsx';
import { LOG_COLUMNS, ShiftLog } from '../../parts/ShiftLog.tsx';
import type { LogCol } from '../../parts/ShiftLog.tsx';
import { EmptyPeriod, FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import { KpiStrip } from '../../ui/kpi.tsx';
import { periodChips } from '../../ui/SideStats.tsx';
import { WeekStrip } from '../../ui/WeekStrip.tsx';
import styles from './LogScreen.module.css';

/* The Log: every shift in the period, grouped by month or week (or flat). Desktop is the dense table, rows opening
 * in place — a card reads great on a phone but shows too few shifts at once on a wide screen. A phone gets the same
 * groups as cards (the card UI stays here for whenever it's wanted again, just not for the desktop table); flat
 * still bands phone cards by week, since a card wants a heading to sit under. Grouping is remembered per device. */
const [groupBy, setGroupBy] = persisted<GroupBy>('log-group', oneOf(GROUP_BYS.map(g => g.id)), 'month');
/** The columns switched off in the Columns menu, remembered per device. */
const LOG_KEYS = LOG_COLUMNS.map(c => c.key);
const [hiddenCols, setHiddenCols] = persisted<LogCol[]>('log-hidden', (v): v is LogCol[] => Array.isArray(v) && v.every(k => LOG_KEYS.includes(k)), []);
const jumpDay = signal<string | null>(null);

export function LogScreen() {
  const all = liveViews.value;
  const views = scopedViews(all);
  const s = summarize(views);
  const by = groupBy.value;
  const problems = sheetProblems.value;
  const selected = sheet.value;
  const desktop = isDesktop.value;
  const ctx = rateContext(views);
  const workedDays = [...new Set(views.map(v => v.shift.date))].sort();

  const alerts = <>
    {state.value === 'failed' && (
      <div class={styles.banner} role="alert"><Icon name="alert" /><span>{syncMessage.value || 'Sync failed.'} Your shifts are saved on this device.</span></div>
    )}
    {problems.length > 0 && (
      <div class={styles.banner} role="alert">
        <Icon name="alert" />
        <div><strong>Fix these in the Sheet, then sync again:</strong><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul></div>
      </div>
    )}
  </>;
  const empty = ready.value && all.length === 0
    ? <FirstShiftEmpty>Add the date, hours and tips. Everything saves on this device first, so it works with no signal.</FirstShiftEmpty>
    : ready.value && views.length === 0
      ? <EmptyPeriod />
      : null;

  const groupControl = (
    <div class="seg" role="radiogroup" aria-label="Group shifts">
      {GROUP_BYS.map(g => (
        <label key={g.id}><input type="radio" name="log-group" checked={by === g.id} onChange={() => setGroupBy(g.id)} /><span>{g.label}</span></label>
      ))}
    </div>
  );

  const jumpTo = (d: string) => {
    jumpDay.value = jumpDay.value === d ? null : d;
    const el = document.querySelector(`[data-date="${d}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <Page title="Shift log" id="log-title" fill={desktop} flush={desktop} bodyClass={desktop ? `list-sheet ${styles.body} ${styles.scroll}` : styles.body}
      tools={<>{groupControl}<ScopeControl /></>}>
      {desktop && <KpiStrip items={periodChips(s, ['Shifts', 'Hours', 'Tips', 'Rate'])} />}
      {desktop && workedDays.length > 0 && (
        <div class={styles.days}>
          <WeekStrip dates={workedDays} selected={jumpDay.value} onSelect={jumpTo} label="Jump to a day" />
        </div>
      )}
      {alerts}
      {empty ?? (desktop
        ? <ShiftLog views={views} by={by} openId={selected} hidden={hiddenCols.value} onHidden={setHiddenCols} air jumpDate={jumpDay.value} />
        : groupShifts(views, by === 'none' ? 'week' : by).map(g => (
          <section key={g.key} class={styles.week} aria-label={g.label}>
            <div class={styles.weekHead}>
              <h3 class={styles.bandName}>{g.label}</h3>
              <span class="fig fig-key">{g.done ? dollars(g.total) : DASH}</span>
            </div>
            <ul class={styles.list}>{g.views.map(v => <ShiftCard key={v.shift.id} v={v} ctx={ctx} selected={selected === v.shift.id} />)}</ul>
          </section>
        )))}
    </Page>
  );
}
