import { useState } from 'preact/hooks';
import { liveViews, liveWages, removeWage, saveWage } from '../../data/store.ts';
import { monthKey, today } from '../../lib/dates.ts';
import { moneyWhole } from '../../lib/format.ts';
import { partsOf } from '../../lib/groups.ts';
import { summarize } from '../../lib/stats.ts';
import { MixBar } from '../../ui/MixBar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './SettingsScreen.module.css';

/** Your hourly wage by start date. Each applies from its date until the next one's; a shift's wage is its hours times the rate in effect that day. */
export function WageRates() {
  const rates = liveWages.value;
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<{ date: string; rate: string } | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    try { setError(''); await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  };
  const valid = (rate: string) => rate.trim() !== '' && Number.isFinite(Number(rate)) && Number(rate) >= 0;

  return (
    <section class={styles.sec} aria-labelledby="wage">
      <p class={styles.p}>Each wage applies from its date until the next one starts. A shift's wage is estimated as its hours × the wage in effect that day, and counts toward its total.</p>
      {error && <p class="error" role="alert">{error}</p>}
      <div class={styles.wages}>
        {rates.map(w => (
          <div class={styles.wageRow} key={w.id + w.date}>
            <label class="field"><span class="label-text">From</span>
              <input class="input" id={`wage-date-${w.id}`} name={`wage-date-${w.id}`} type="date" value={w.date} onChange={e => { const d = e.currentTarget.value; if (d) void run(() => saveWage({ id: w.id, date: d, rate: w.rate, note: w.note })); }} />
            </label>
            <label class="field"><span class="label-text">$ / hour</span>
              <input class="input num" id={`wage-rate-${w.id}`} name={`wage-rate-${w.id}`} type="number" inputMode="decimal" step="0.01" min="0" value={w.rate}
                onChange={e => { const r = e.currentTarget.value; if (valid(r)) void run(() => saveWage({ id: w.id, date: w.date, rate: Number(r), note: w.note })); }} />
            </label>
            <button type="button" class="btn btn-quiet btn-icon" aria-label={`Remove the wage from ${w.date}`}
              onClick={() => void run(async () => { const gone = await removeWage(w.id); if (gone) toast('Wage removed', { label: 'Undo', run: () => void saveWage({ id: gone.id, date: gone.date, rate: gone.rate, note: gone.note }) }); })}><Icon name="trash" /></button>
          </div>
        ))}
        {draft && (
          <form class={styles.wageRow} onSubmit={e => { e.preventDefault(); if (draft.date && valid(draft.rate)) void run(async () => { await saveWage({ date: draft.date, rate: Number(draft.rate) }); setDraft(null); }); }}>
            <label class="field"><span class="label-text">From</span>
              <input class="input" id="wage-date-new" name="wage-date-new" type="date" value={draft.date} onInput={e => setDraft({ ...draft, date: e.currentTarget.value })} required />
            </label>
            <label class="field"><span class="label-text">$ / hour</span>
              <input class="input num" id="wage-rate-new" name="wage-rate-new" type="number" inputMode="decimal" step="0.01" min="0" value={draft.rate} placeholder="0.00" onInput={e => setDraft({ ...draft, rate: e.currentTarget.value })} required autoFocus />
            </label>
            <button type="submit" class="btn btn-primary">Add</button>
          </form>
        )}
      </div>
      {rates.length === 0 && !draft && <p class={styles.p}>No wage set yet, so shifts show no wage.</p>}
      <WageEffect />
      {!draft && <div class={styles.actions}><button type="button" class="btn" onClick={() => setDraft({ date: today(), rate: '' })}><Icon name="plus" /> Add a wage</button></div>}
    </section>
  );
}

/** What the wage adds up to this month, as a share of everything earned: the same mix bar a shift uses. */
function WageEffect() {
  const key = monthKey(today());
  const s = summarize(liveViews.value.filter(v => v.shift.date.startsWith(key)));
  if (!s.total) return null;
  const month = new Date(key + '-01T12:00:00').toLocaleDateString(undefined, { month: 'long' });
  const pct = Math.round((s.wage / s.total) * 100);
  return (
    <div class={styles.effect} aria-live="polite">
      <p class={styles.p}>{s.wage ? <>Wage is <b>{pct}%</b> of your {month} total ({moneyWhole(s.wage)} of {moneyWhole(s.total)}).</> : <>No wage counted in {month} yet.</>}</p>
      <MixBar parts={partsOf(s.tips, s.wage, [], s.extra || null)} />
    </div>
  );
}
