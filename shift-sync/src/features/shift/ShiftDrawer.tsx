import { useEffect, useRef } from 'preact/hooks';
import { hoursWorked } from '../../core/core.generated.js';
import { personById, ready, removeShift, undoRemove, viewById } from '../../data/store.ts';
import { DASH, clock, clockShort, dec1, hours, longDate, money } from '../../lib/format.ts';
import { closeSheet, openForm } from '../../router.ts';
import { DrawerFrame } from '../../ui/DrawerFrame.tsx';
import type { FrameApi } from '../../ui/DrawerFrame.tsx';
import { PartyBadge, SourceBadge, TypeBadge } from '../../ui/Badges.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
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
        <section class={styles.section}>
          <dl class={styles.kv}>
            <div><dt>Start</dt><dd class="num">{clock(sh.start) || DASH}</dd></div>
            <div><dt>End</dt><dd class="num">{clock(sh.end) || DASH}</dd></div>
            <div><dt>Hours</dt><dd class="num">{hours(v.hours)}</dd></div>
          </dl>
        </section>
        <section class={styles.section}>
          <h3 class="label">Crew</h3>
          {v.crew.length === 0 ? <p class={styles.legacy}>No bartenders logged. Edit the shift to add who worked it.</p> : (
            <dl class={styles.kv}>
              {v.crew.map(c => {
                const p = personById(c.staff_id);
                return (
                  <div key={c.id}>
                    <dt>{p?.name ?? c.name ?? 'Unknown'}{p?.is_user && <span class={styles.note}>you</span>}</dt>
                    <dd class="num"><small>{clockShort(c.start) || DASH}–{clockShort(c.end) || DASH}</small>{hoursWorked(c.start, c.end) == null ? DASH : `${dec1(hoursWorked(c.start, c.end))}h`}</dd>
                  </div>
                );
              })}
              <div class={styles.total}><dt>{v.crewCount} {v.crewCount === 1 ? 'bartender' : 'bartenders'}</dt><dd class="num">{dec1(v.crewHours)}h</dd></div>
            </dl>
          )}
        </section>
        <section class={styles.section}>
          <dl class={styles.kv}>
            {/* tips/hr here is this record's own arithmetic, not a ranking metric (Rate stays tips-only). */}
            <div><dt>Tips</dt><dd class="num">{v.tph != null && <small>{money(v.tph)}/hr</small>}{money(sh.tips)}</dd></div>
            {v.wage != null && <div><dt>Wage <span class={styles.note}>estimated</span></dt><dd class="num"><small>{dec1(v.hours)}h × ${v.wageRate}/hr</small>{money(v.wage)}</dd></div>}
            {v.income.map(i => (
              <div key={i.id}><dt><SourceBadge source={i.category} />{i.note && <span class={styles.note}>{i.note}</span>}</dt><dd class="num">{money(i.amount)}</dd></div>
            ))}
            {sh.other ? <div><dt>Other <span class={styles.note}>(earlier entry)</span></dt><dd class="num">{money(sh.other)}</dd></div> : null}
            <div class={styles.total}><dt>Total</dt><dd class="num">{money(v.total)}</dd></div>
          </dl>
        </section>
        {sh.notes && <section class={styles.section}><p class={styles.notes}>{sh.notes}</p></section>}
        {sh._dirty && <p class={styles.sync}>Not synced yet. It will sync when you're online.</p>}
      </div>
    </DrawerFrame>
  );
}
