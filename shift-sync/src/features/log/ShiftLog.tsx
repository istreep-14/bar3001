import { personById, removeShift, undoRemove } from '../../data/store.ts';
import { DASH, clockPlain, dollars, hours, money } from '../../lib/format.ts';
import { groupShifts, isPending, rowDay } from '../../lib/groups.ts';
import type { GroupBy } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { closeSheet, openForm, openSheet } from '../../router.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import { ShiftDetails } from '../shift/ShiftDetails.tsx';
import styles from './ShiftLog.module.css';

/* The desktop Log. Rows are grouped by month or week: a band names the group once (with a count and the group's
 * total, lined up in the Total column), and the rows under it are indented and only say the day. Opening a row turns it
 * into a card in place (?shift=<id>, so it is still a link and Back closes it), with the income mix bar and the same
 * stacked lists as the drawer. The drawer does not also open on this page. */
const CREW_SHOWN = 3;

/** `inline` = rows open into a card in place (the Log). Off, a row opens the drawer instead (the Dashboard's short list). */
export function ShiftLog({ views, by, openId, inline = true }: { views: ShiftView[]; by: GroupBy; openId: string | null; inline?: boolean }) {
  const groups = groupShifts(views, by);
  const grouped = by !== 'none';
  return (
    <div class={styles.log} data-grouped={grouped ? '' : undefined} onKeyDown={moveFocus}>
      <div class={`${styles.grid} ${styles.head}`} aria-hidden="true">
        <span />{/* indent */}
        <span>{grouped ? 'Day' : 'Shift'}</span><span>Time</span><span class="r">Hours</span><span class="r">Tips</span><span class="r">Tips / hr</span><span class="r">Total</span><span>Crew</span><span />
      </div>
      {groups.map(g => (
        <div class={styles.group} key={g.key}>
          {grouped && (
            <div class={`${styles.grid} ${styles.band}`} role="heading" aria-level={3}>
              <span class={styles.bandLabel}>
                <span class={styles.bandName}>{g.label}</span>
                <span class="chip num">{[g.done && `${g.done} ${g.done === 1 ? 'shift' : 'shifts'}`, g.pending && `${g.pending} waiting on tips`].filter(Boolean).join(' · ')}</span>
              </span>
              <span class={`r num ${styles.bandTotal}`}>{g.done ? dollars(g.total) : DASH}</span>
            </div>
          )}
          <div class={styles.rows} role="list" aria-label={g.label || 'Shifts'}>
            {g.views.map(v => <Row key={v.shift.id} v={v} by={by} open={inline && openId === v.shift.id} selected={openId === v.shift.id} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ v, by, open, selected }: { v: ShiftView; by: GroupBy; open: boolean; selected: boolean }) {
  const sh = v.shift, id = sh.id;
  const time = sh.start != null && sh.end != null ? `${clockPlain(sh.start)} – ${clockPlain(sh.end)}` : clockPlain(sh.start);
  if (isPending(v)) {
    return (
      <div class={`${styles.grid} ${styles.row} ${styles.pending}`} role="listitem">
        <span />
        <span class={styles.day}>{rowDay(sh.date, by)}</span>
        <span class={styles.time}>{time || DASH}<span class="chip" data-kind="pending">Waiting on tips</span></span>
        <span class={styles.fillCell}><button type="button" class="btn" data-row onClick={() => openForm(id)}>Fill in tips</button></span>
        <span /><span />
      </div>
    );
  }
  async function remove() {
    closeSheet();   // the card goes with the shift; Undo brings the row back closed
    const gone = await removeShift(id);
    if (gone) toast('Shift deleted', { label: 'Undo', run: () => void undoRemove(gone) });
  }
  const shown = v.crew.slice(0, CREW_SHOWN);
  return (
    <div class={styles.item} data-open={open ? '' : undefined} data-selected={selected && !open ? '' : undefined} role="listitem">
      <button type="button" class={`${styles.grid} ${styles.row}`} data-row aria-expanded={open} onClick={() => openSheet(id)}>
        <span />
        <span class={styles.day}>{open ? rowDay(sh.date, 'none') : rowDay(sh.date, by)}</span>
        <span class={styles.time}>{time || DASH}{sh.party && <span class="chip" data-kind="party">Party</span>}</span>
        <span class="r num">{hours(v.hours)}</span>
        <span class={`r num ${styles.strong}`}>{dollars(sh.tips)}</span>
        <span class={`r num ${styles.muted}`}>{v.tph == null ? DASH : money(v.tph)}</span>
        <span class={`r num ${styles.strong}`}>{dollars(v.total)}</span>
        <span class="avatars">
          {shown.map(c => <Avatar key={c.id} id={c.staff_id} name={personById(c.staff_id)?.name ?? c.name ?? '?'} />)}
          {v.crewCount > CREW_SHOWN && <span class="avatar avatar-more">+{v.crewCount - CREW_SHOWN}</span>}
        </span>
        <span class={styles.chev}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div class={styles.card}>
          <ShiftDetails v={v} layout="columns" />
          {sh._dirty && <p class={styles.sync}>Not synced yet. It will sync when you're online.</p>}
          <div class={styles.actions}>
            <button type="button" class="btn btn-primary" onClick={() => openForm(id)}><Icon name="edit" /> Edit shift</button>
            <span class={styles.spacer} />
            <button type="button" class="btn" onClick={() => void remove()}><Icon name="trash" /> Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Up and Down walk the rows (buttons carrying data-row), across groups. */
function moveFocus(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const all = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-row]')];
  const i = all.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  all[e.key === 'ArrowDown' ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1)]?.focus();
}
