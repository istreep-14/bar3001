import { useState } from 'preact/hooks';
import { saveSettings, settings } from '../../data/settings.ts';
import { lastSynced, state, sync, syncMessage } from '../../data/sync.ts';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './SettingsScreen.module.css';

export function SheetSync() {
  const [api, setApi] = useState(settings.value.api);
  const [token, setToken] = useState(settings.value.token);
  const s = state.value;
  const changed = api.trim() !== settings.value.api || token.trim() !== settings.value.token;

  function save(e: Event) {
    e.preventDefault();
    saveSettings({ api: api.trim(), token: token.trim() });
    toast('Connection saved');
    void sync();
  }

  return (
    <div class={styles.stack}>
      <section class={styles.sec} aria-labelledby="conn">
        <h3 id="conn" class="label">Connection</h3>
        <p class={styles.status} role="status">
          <Icon name={s === 'idle' ? 'check' : s === 'syncing' ? 'refresh' : 'alert'} />
          {s === 'unconfigured' && 'Not connected. Shifts are saved on this device only.'}
          {s === 'idle' && `Connected. Last synced ${lastSynced.value ? new Date(lastSynced.value).toLocaleString() : 'never'}.`}
          {s === 'syncing' && 'Syncing…'}
          {s === 'offline' && 'Offline. Changes will sync when you reconnect.'}
          {s === 'failed' && (syncMessage.value || 'Last sync failed.')}
        </p>
        <form class={styles.form} onSubmit={save}>
          <label class="field"><span class="label-text">Web app URL</span>
            <input class="input" type="url" value={api} placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" onInput={e => setApi(e.currentTarget.value)} />
          </label>
          <label class="field"><span class="label-text">Token</span>
            <input class="input" type="password" value={token} autocomplete="off" onInput={e => setToken(e.currentTarget.value)} />
            <span class="hint">Run setup in the Apps Script editor to see your token.</span>
          </label>
          <div class={styles.actions}>
            <button class="btn btn-primary" type="submit" disabled={!changed || !api.trim() || !token.trim()}>Save connection</button>
            <button class="btn" type="button" onClick={() => void sync()} disabled={s === 'unconfigured' || s === 'syncing'}><Icon name="refresh" /> Sync now</button>
          </div>
        </form>
      </section>
    </div>
  );
}
