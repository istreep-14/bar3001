import { dateCell, weekdayShort } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm } from '../../router.ts';
import styles from './Hub.module.css';

/** One control in the panel head in place of a form above the list: pick one of the period's shifts and its form opens on
 *  the page that adds to it (Other for income, Crew for crew). Everything else about adding lives in that form. */
export function AddToShift({ views, page, label }: { views: ShiftView[]; page: 'misc' | 'crew'; label: string }) {
  return (
    <label class={styles.filter}><span class="sr-only">{label}</span>
      <select class="input" value="" aria-label={label} disabled={views.length === 0}
        onChange={e => { const id = e.currentTarget.value; e.currentTarget.value = ''; if (id) openForm(id, undefined, page); }}>
        <option value="">Add to a shift…</option>
        {views.map(v => <option key={v.shift.id} value={v.shift.id}>{weekdayShort(v.shift.date)} {dateCell(v.shift.date)}{v.shift.shift_type ? ` · ${v.shift.shift_type}` : ''}</option>)}
      </select>
    </label>
  );
}
