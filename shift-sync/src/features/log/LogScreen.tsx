import { signal } from '@preact/signals';
import { scopedViews } from '../../data/scope.ts';
import { liveViews, ready } from '../../data/store.ts';
import { sheetProblems, state, syncMessage } from '../../data/sync.ts';
import { DASH, dollars, hours, moneyWhole, perHour } from '../../lib/format.ts';
import { GROUP_BYS, groupShifts } from '../../lib/groups.ts';
import type { GroupBy } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import { openForm, sheet } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import { ShiftCard } from './ShiftCard.tsx';
import { ShiftLog } from './ShiftLog.tsx';
import styles from './LogScreen.module.css';

/* The Log: every shift in the period, grouped by month or week (or flat). Desktop is the grouped list with rows that
 * open in place; a phone gets the same groups as cards. Grouping is remembered per device. */
const KEY = 'log-group';
const readBy = (): GroupBy => {
  try { const v = localStorage.getItem(KEY); if (GROUP_BYS.some(g => g.id === v)) return v as GroupBy; } catch { /* private mode */ }
  return 'month';
};
const groupBy = signal<GroupBy>(readBy());
const setGroupBy = (by: GroupBy) => { groupBy.value = by; try { localStorage.setItem(KEY, by); } catch { /* private mode */ } };

export function LogScreen() {
  const all = liveViews.value;
  const views = scopedViews(all);
  const s = summarize(views);
  const by = groupBy.value;
  const problems = sheetProblems.value;
  const selected = sheet.value;
  const desktop = isDesktop.value;

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
    ? <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> Add shift</button>}>Add the date, hours and tips. Everything saves on this device first, so it works with no signal.</EmptyState>
    : ready.value && views.length === 0
      ? <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>
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
            {empty ?? <ShiftLog views={views} by={by} openId={selected} />}
          </div>
          <aside class="panel-body side" aria-label="This period">
            <div class="side-block">
              <h3 class="label">This period</h3>
              <StatList items={[
                { label: 'Shifts', value: s.shifts },
                { label: 'Hours', value: hours(s.hours) },
                { label: 'Tips', value: moneyWhole(s.tips) },
                { label: 'Rate', value: perHour(s.tph), hint: 'Tips over hours worked' },
                { label: 'Total', value: moneyWhole(s.total), hint: 'Tips, estimated wage and other income' }
              ]} />
              <p class="muted side-note">Rate is tips over hours. Total also includes wage and other income.</p>
            </div>
          </aside>
        </div>
      ) : (
        <div class={`panel-body ${styles.body}`}>
          {alerts}
          {empty ?? groupShifts(views, by === 'none' ? 'week' : by).map(g => (
            <section key={g.key} class={styles.week} aria-label={g.label}>
              <div class={styles.weekHead}>
                <h2 class={styles.bandName}>{g.label}</h2>
                <span class="num">{g.done ? dollars(g.total) : DASH}</span>
              </div>
              <ul class={styles.list}>{g.views.map(v => <ShiftCard key={v.shift.id} v={v} avg={s.tph} selected={selected === v.shift.id} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
