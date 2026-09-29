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
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import { ShiftCard } from './ShiftCard.tsx';
import { LOG_COLUMNS, ShiftLog } from '../../parts/ShiftLog.tsx';
import type { LogCol } from '../../parts/ShiftLog.tsx';
import { EmptyPeriod, FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import { SideStats, periodItems } from '../../ui/SideStats.tsx';
import styles from './LogScreen.module.css';

/* The Log: every shift in the period, grouped by month or week (or flat). Desktop is the dense table, rows opening
 * in place — a card reads great on a phone but shows too few shifts at once on a wide screen. A phone gets the same
 * groups as cards (the card UI stays here for whenever it's wanted again, just not for the desktop table); flat
 * still bands phone cards by week, since a card wants a heading to sit under. Grouping is remembered per device. */
const [groupBy, setGroupBy] = persisted<GroupBy>('log-group', oneOf(GROUP_BYS.map(g => g.id)), 'month');
/** The columns switched off in the Columns menu, remembered per device. */
const LOG_KEYS = LOG_COLUMNS.map(c => c.key);
const [hiddenCols, setHiddenCols] = persisted<LogCol[]>('log-hidden', (v): v is LogCol[] => Array.isArray(v) && v.every(k => LOG_KEYS.includes(k)), []);

export function LogScreen() {
  const all = liveViews.value;
  const views = scopedViews(all);
  const s = summarize(views);
  const by = groupBy.value;
  const problems = sheetProblems.value;
  const selected = sheet.value;
  const desktop = isDesktop.value;
  const ctx = rateContext(views);

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

  return (
    <section class={`panel ${desktop ? 'fill' : ''}`} aria-labelledby="log-title">
      <PanelHead title="Shift log" id="log-title">{groupControl}<ScopeControl /></PanelHead>
      {desktop ? (
        <div class="split">
          <div class={`panel-body flush ${styles.body} ${styles.scroll}`}>
            {alerts}
            {empty ?? <ShiftLog views={views} by={by} openId={selected} hidden={hiddenCols.value} onHidden={setHiddenCols} />}
          </div>
          <SideStats items={periodItems(s)} note="Rate is tips over hours. Total also includes wage and other income." />
        </div>
      ) : (
        <div class={`panel-body ${styles.body}`}>
          {alerts}
          {empty ?? groupShifts(views, by === 'none' ? 'week' : by).map(g => (
            <section key={g.key} class={styles.week} aria-label={g.label}>
              <div class={styles.weekHead}>
                <h2 class={styles.bandName}>{g.label}</h2>
                <span class="fig fig-key">{g.done ? dollars(g.total) : DASH}</span>
              </div>
              <ul class={styles.list}>{g.views.map(v => <ShiftCard key={v.shift.id} v={v} ctx={ctx} selected={selected === v.shift.id} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
