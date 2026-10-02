import { dateCell, weekdayShort } from '../../lib/format.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm } from '../../router.ts';
import { Switcher } from '../../ui/Switcher.tsx';

/** One control in the toolbar in place of a form above the list: an "Add to shift" menu of the period's shifts; picking
 *  one opens its form on the page that adds to it (Other for income, Crew for crew). Everything else about adding lives in
 *  that form. */
export function AddToShift({ views, page, label, compact }: { views: ShiftView[]; page: 'misc' | 'crew'; label: string; compact?: boolean }) {
  return (
    <Switcher label={label} icon="plus" value="" align="right" disabled={views.length === 0} compact={compact} tone={compact ? 'add' : undefined} onChange={id => { if (id) openForm(id, undefined, page); }}
      choices={views.map(v => ({ value: v.shift.id, label: `${weekdayShort(v.shift.date)} ${dateCell(v.shift.date)}`, hint: v.shift.shift_type ?? undefined }))} />
  );
}
