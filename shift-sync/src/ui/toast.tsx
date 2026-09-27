import { signal } from '@preact/signals';
import styles from './toast.module.css';

interface Toast { message: string; action?: { label: string; run: () => void } }
const current = signal<Toast | null>(null);
let timer: number | undefined;

/** One toast at a time. Auto-dismisses (longer when there's an action to reach). */
export function toast(message: string, action?: Toast['action']) {
  clearTimeout(timer);
  current.value = { message, action };
  timer = window.setTimeout(() => { current.value = null; }, action ? 6000 : 3500);
}

export function Toaster() {
  const t = current.value;
  return (
    <div class={styles.host} role="status" aria-live="polite">
      {t && (
        <div class={styles.toast} key={t.message}>
          <span>{t.message}</span>
          {t.action && <button class={styles.action} onClick={() => { t.action!.run(); current.value = null; }}>{t.action.label}</button>}
        </div>
      )}
    </div>
  );
}
