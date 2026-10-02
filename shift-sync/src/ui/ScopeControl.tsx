import { useState } from 'preact/hooks';
import { scope, scopeLabel, setLast, setScope } from '../data/scope.ts';
import { today } from '../lib/dates.ts';
import { PRESETS, UNITS, clampN, sameScope, startOf } from '../lib/scope.ts';
import type { Scope, Unit } from '../lib/scope.ts';
import { Switcher } from './Switcher.tsx';
import styles from './ScopeControl.module.css';

/** What each preset reads as in the switcher's list. */
const WORDS: Record<string, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '1y': 'Last year', All: 'All time' };

/** A few characters for the period, short enough to sit under the icon: "30d", "12w", "All". A custom date range has no
 *  short form, so the mark is a dot and the dates stay in the menu. */
function scopeMark(s: Scope): string {
  const preset = PRESETS.find(p => sameScope(s, p.scope));
  if (preset) return preset.label;
  if (s.mode === 'range') return '';
  if (s.mode !== 'last') return 'All';
  const unit = { days: 'd', weeks: 'w', months: 'mo', years: 'y', shifts: 'sh' } as const;
  return `${s.n}${unit[s.unit]}`;
}

/** The one period control, shared by every page that shows a period: a "Range" switcher of quick presets, plus any length
 *  you like (N days / weeks / months / years, or the last N shifts) or a custom date range, set in its own panel. The
 *  button also says the dates the period comes to. `compact` drops that sentence for a short mark under the icon. */
export function ScopeControl({ compact }: { compact?: boolean } = {}) {
  const s = scope.value;
  // Picking "Custom length" on a preset keeps that length and opens its fields, ready to change.
  const [editing, setEditing] = useState(false);
  const preset = PRESETS.find(p => sameScope(s, p.scope));
  const value = editing && s.mode === 'last' ? 'custom' : preset ? preset.label : s.mode === 'range' ? 'range' : 'custom';
  const choices = [
    ...PRESETS.map(p => ({ value: p.label, label: WORDS[p.label] ?? p.label })),
    { value: 'custom', label: s.mode === 'last' && !preset ? `Last ${s.n} ${UNITS.find(u => u.id === s.unit)?.label ?? s.unit}` : 'Custom length' },
    { value: 'range', label: 'Dates' }
  ];
  const pick = (v: string) => {
    setEditing(v === 'custom');
    const p = PRESETS.find(x => x.label === v);
    if (p) setScope(p.scope);
    else if (v === 'range') { if (s.mode !== 'range') setScope({ mode: 'range', from: startOf(30, 'days', today()), to: today() }); }
    else if (s.mode !== 'last') setLast(30, 'days');
  };
  // The panel's own fields: the length when it's a custom one (or being made one), the dates for a range, else none.
  const fields = value === 'custom' && s.mode === 'last' ? (
    <div class={styles.custom} role="group" aria-label="Custom length">
      <span class={styles.word}>Last</span>
      <input key={`${s.n}${s.unit}`} class={`input ${styles.n}`} id="scope-n" name="scope-n" type="number" min={1} max={999} inputMode="numeric" defaultValue={s.n} aria-label="How many"
        onChange={e => { const n = clampN(e.currentTarget.valueAsNumber); if (n) setLast(n, s.unit); else e.currentTarget.value = String(s.n); }} />
      <select class={`input ${styles.unit}`} id="scope-unit" name="scope-unit" value={s.unit} aria-label="Unit" onChange={e => setLast(s.n, e.currentTarget.value as Unit)}>
        {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </div>
  ) : s.mode === 'range' ? (
    <div class={styles.custom} role="group" aria-label="Date range">
      <input class={`input ${styles.date}`} id="scope-from" name="scope-from" type="date" value={s.from} max={s.to} aria-label="From" onChange={e => e.currentTarget.value && setScope({ ...s, from: e.currentTarget.value })} />
      <span class={styles.word}>to</span>
      <input class={`input ${styles.date}`} id="scope-to" name="scope-to" type="date" value={s.to} min={s.from} aria-label="To" onChange={e => e.currentTarget.value && setScope({ ...s, to: e.currentTarget.value })} />
    </div>
  ) : null;
  // The dates the period comes to, after the value — not when they'd only repeat it (all time, the last N shifts).
  const note = s.mode === 'all' || (s.mode === 'last' && s.unit === 'shifts') ? undefined : <span aria-live="polite">{scopeLabel()}</span>;
  return (
    <Switcher label="Range" icon="calendar" value={value} choices={choices} onChange={pick} stay={['custom', 'range']} align="right" note={compact ? undefined : note} compact={compact} mark={compact ? scopeMark(s) : undefined}>
      {fields}
    </Switcher>
  );
}
