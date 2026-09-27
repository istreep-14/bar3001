import { scope, scopeLabel, setLast, setScope } from '../data/scope.ts';
import { today } from '../lib/dates.ts';
import { PRESETS, UNITS, clampN, sameScope, startOf } from '../lib/scope.ts';
import type { Unit } from '../lib/scope.ts';
import styles from './ScopeControl.module.css';

/** The one period control, shared by Log, Earnings and Rate: quick presets, plus any length you like
 *  (N days / weeks / months / years, or the last N shifts) or a custom date range. */
export function ScopeControl() {
  const s = scope.value;
  const isRange = s.mode === 'range';
  return (
    <div class={styles.scope}>
      <div class="seg" role="radiogroup" aria-label="Period">
        {PRESETS.map(p => (
          <label key={p.label}>
            <input type="radio" name="scope-preset" checked={sameScope(s, p.scope)} onChange={() => setScope(p.scope)} />
            <span>{p.label}</span>
          </label>
        ))}
        <label>
          <input type="radio" name="scope-preset" checked={isRange} onChange={() => setScope({ mode: 'range', from: startOf(30, 'days', today()), to: today() })} />
          <span>Dates</span>
        </label>
      </div>

      {s.mode === 'last' && (
        <div class={styles.custom} role="group" aria-label="Custom length">
          <span class={styles.word}>Last</span>
          <input key={`${s.n}${s.unit}`} class={`input ${styles.n}`} type="number" min={1} max={999} inputMode="numeric" defaultValue={s.n} aria-label="How many"
            onChange={e => { const n = clampN(e.currentTarget.valueAsNumber); if (n) setLast(n, s.unit); else e.currentTarget.value = String(s.n); }} />
          <select class={`input ${styles.unit}`} value={s.unit} aria-label="Unit" onChange={e => setLast(s.n, e.currentTarget.value as Unit)}>
            {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      )}
      {s.mode === 'range' && (
        <div class={styles.custom} role="group" aria-label="Date range">
          <input class={`input ${styles.date}`} type="date" value={s.from} max={s.to} aria-label="From" onChange={e => e.currentTarget.value && setScope({ ...s, from: e.currentTarget.value })} />
          <span class={styles.word}>to</span>
          <input class={`input ${styles.date}`} type="date" value={s.to} min={s.from} aria-label="To" onChange={e => e.currentTarget.value && setScope({ ...s, to: e.currentTarget.value })} />
        </div>
      )}
      <span class={styles.resolved} aria-live="polite">{scopeLabel()}</span>
    </div>
  );
}
