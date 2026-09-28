import { openForm } from '../router.ts';
import { Icon } from './Icon.tsx';
import type { ComponentChildren } from 'preact';

/** The one empty state: what is missing, what to do about it. */
export function EmptyState({ title, children, action }: { title: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Nothing logged yet, anywhere: the one call to action every data page shows. `children` says what will appear here. */
export function FirstShiftEmpty({ children }: { children: ComponentChildren }) {
  return <EmptyState title="Log your first shift" action={<button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> New shift</button>}>{children}</EmptyState>;
}

/** Shifts exist, just none in the chosen period. */
export const EmptyPeriod = () => <EmptyState title="No shifts in this period">Widen the period above, or choose All, to see the rest.</EmptyState>;
