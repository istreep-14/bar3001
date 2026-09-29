import { pendingCount } from '../data/store.ts';
import { lastSynced, state, sync, syncMessage } from '../data/sync.ts';
import { go } from '../router.ts';
import { Icon } from '../ui/Icon.tsx';
import type { IconName } from '../ui/Icon.tsx';
import styles from './SyncPill.module.css';

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

/** Always says what state the data is in, with an icon and words (never color alone). */
export function SyncPill() {
  const s = state.value, n = pendingCount.value;
  let icon: IconName = 'check', text = lastSynced.value ? `Synced ${ago(lastSynced.value)}` : 'Synced', tone = '';
  let onClick: () => void = () => void sync();
  if (s === 'unconfigured') { icon = 'cloudOff'; text = 'Not connected'; tone = styles.warn!; onClick = () => go('settings/sync'); }
  else if (s === 'syncing') { icon = 'refresh'; text = 'Syncing'; tone = styles.spin!; }
  else if (s === 'offline') { icon = 'cloudOff'; text = n ? `Offline, ${n} to sync` : 'Offline'; }
  else if (s === 'failed') { icon = 'alert'; text = 'Sync failed, retry'; tone = styles.warn!; }
  else if (n) { icon = 'refresh'; text = `${n} to sync`; }
  return (
    <button class={`${styles.pill} ${tone}`} onClick={onClick} title={s === 'failed' ? syncMessage.value : undefined}>
      <Icon name={icon} /> {text}
    </button>
  );
}
