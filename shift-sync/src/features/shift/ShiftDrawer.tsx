import { useEffect, useRef } from 'preact/hooks';
import { ready, removeShift, undoRemove, viewById } from '../../data/store.ts';
import { longDate } from '../../lib/format.ts';
import { closeSheet, openForm } from '../../router.ts';
import { DrawerFrame } from '../../ui/DrawerFrame.tsx';
import type { FrameApi } from '../../ui/DrawerFrame.tsx';
import { PartyBadge, TypeBadge } from '../../ui/Badges.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import { ShiftDetails } from '../../parts/ShiftDetails.tsx';
import styles from '../../ui/drawer.module.css';

/* The shift drawer: a quick read-only look at one shift. Editing (and adding) is the shift form, a dialog:
 * the pencil hands off to it. Same content in both hosts (panel = desktop card, dialog = phone sheet). */
export function ShiftDrawer({ id, host }: { id: string; host: 'panel' | 'dialog' }) {
  const frame = useRef<FrameApi | null>(null);
  const v = viewById(id);
  useEffect(() => { if (ready.value && !v) closeSheet(); }, [v]);
  if (!v) return null;
  const sh = v.shift;

  async function remove() {
    const gone = await removeShift(id);
    frame.current?.close();
    if (gone) toast('Shift deleted', { label: 'Undo', run: () => void undoRemove(gone) });
  }

  return (
    <DrawerFrame host={host} labelledBy="drawer-title" requestClose={() => frame.current?.close()} apiRef={frame}>
      <header class={styles.head}>
        <div class={styles.title}>
          <h2 id="drawer-title" class="h-title">{longDate(sh.date)}</h2>
          <span class={styles.badges}><TypeBadge type={sh.shift_type} />{sh.party && <PartyBadge />}</span>
        </div>
        <div class={styles.actions}>
          <button type="button" class="btn btn-quiet btn-icon" onClick={() => openForm(id)} aria-label="Edit shift"><Icon name="edit" /></button>
          <button type="button" class="btn btn-quiet btn-icon" onClick={() => void remove()} aria-label="Delete shift"><Icon name="trash" /></button>
          <button type="button" class="btn btn-quiet btn-icon" onClick={() => frame.current?.close()} aria-label="Close"><Icon name="x" /></button>
        </div>
      </header>
      <div class={styles.body}>
        <ShiftDetails v={v} layout="stack" />
        {sh._dirty && <p class={styles.sync}>Not synced yet. It will sync when you're online.</p>}
      </div>
    </DrawerFrame>
  );
}
