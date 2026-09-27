import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { closeDrawer, drawerAsk } from '../router.ts';
import styles from './drawer.module.css';

export interface FrameApi { close: () => void; root: () => HTMLElement | null }

/* The one drawer chrome, shared by the shift and person editors.
 *   panel   desktop: the floating card in the shell
 *   dialog  phone: modal bottom sheet
 * `requestClose` is asked first for every user-initiated close (Esc, backdrop) so an editor can confirm
 * discarding edits. `api.close()` closes without asking (after a save or a delete). */
export function DrawerFrame({ host, labelledBy, requestClose, apiRef, children }: {
  host: 'panel' | 'dialog'; labelledBy: string; requestClose: () => void; apiRef: RefObject<FrameApi | null>; children: ComponentChildren;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLElement>(null);
  (apiRef as { current: FrameApi | null }).current = {
    close: () => (host === 'dialog' ? dlg.current?.close() : closeDrawer()),
    root: () => (host === 'dialog' ? dlg.current : root.current)
  };
  useEffect(() => { if (host === 'dialog') dlg.current?.showModal(); }, [host]);
  useEffect(() => {
    if (host !== 'panel') return;
    drawerAsk.close = requestClose;
    return () => { if (drawerAsk.close === requestClose) drawerAsk.close = null; };
  });

  if (host === 'panel') {
    return <section ref={root} class={styles.panel} aria-labelledby={labelledBy} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); requestClose(); } }}>
      <div class={styles.column}>{children}</div>
    </section>;
  }
  return (
    <dialog ref={dlg} class={styles.dialog} aria-labelledby={labelledBy}
      onCancel={e => { e.preventDefault(); requestClose(); }} onClose={() => closeDrawer()}
      onClick={e => { if (e.target === dlg.current) requestClose(); }}>
      <div class={`${styles.dialogInner} ${styles.column}`}>{children}</div>
    </dialog>
  );
}
