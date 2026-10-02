import { STATUS_LABEL } from '../lib/groups.ts';
import type { ShiftStatus } from '../lib/groups.ts';
import { Icon } from './Icon.tsx';

/** Day/night pill: word + color (+ icon unless `bare`, the table form), so it survives without color. */
export function TypeBadge({ type, iconOnly, bare }: { type: 'day' | 'night' | null; iconOnly?: boolean; bare?: boolean }) {
  if (!type) return null;
  const label = type === 'day' ? 'Day' : 'Night';
  if (iconOnly) return <span class="badge" data-kind={type} title={label}><Icon name={type === 'day' ? 'sun' : 'moon'} label={`${label} shift`} /></span>;
  return <span class="badge" data-kind={type}>{!bare && <Icon name={type === 'day' ? 'sun' : 'moon'} />}{label}</span>;
}

/** Day or night as one round icon (sun or moon) in the shift's colour: for tight places like a calendar card. */
export const TypeIcon = ({ type }: { type: 'day' | 'night' | null }) => type
  ? <span class="tbadge" data-kind={type} title={type === 'day' ? 'Day shift' : 'Night shift'}><Icon name={type === 'day' ? 'sun' : 'moon'} label={type === 'day' ? 'Day shift' : 'Night shift'} /></span>
  : null;
export const PartyIcon = () => <span class="tbadge" data-kind="party" title="Party"><Icon name="star" label="Party" /></span>;

/** A party (private event) happened on the shift: star + word, so it survives without color. */
export const PartyBadge = ({ bare }: { bare?: boolean }) => <span class="badge" data-kind="party">{!bare && <Icon name="star" />}Party</span>;

export const SourceBadge = ({ source }: { source: string }) => <span class="badge" data-kind={source}><i class="dot" />{source}</span>;

/** A status word in a pill, so colour is never the only signal. */
export function StatusPill({ status, children }: { status: string; children: string }) {
  return <span class="status-pill" data-status={status}><i />{children}</span>;
}
/** A crew line or shift still on the clock: start is known, end is not. */
export const OpenPill = () => <StatusPill status="open">Open</StatusPill>;

/** What each shift status means for the totals, said in the pill's tooltip and to a screen reader. */
export const STATUS_TIP: Record<ShiftStatus, string> = {
  worked: 'Clocked out, tips not logged yet. Not counted in totals.',
  scheduled: 'Scheduled. Counts once it is done.',
  done: 'Done. Counted in totals.'
};

/** Where a shift stands, as a soft pill with a dot: 'Awaiting tips' (amber), 'Upcoming' (an outline with a night dot) or
 *  'Done' (neutral; the Sheet view only, since every other view shows done shifts by their figures). On a pending row
 *  it sits in the first money cell and runs across the blank ones after it (ui.css `td:has(> .status-pill)`).
 *  `compact` is the small form for a second line or a narrow cell. Carries its own tooltip and sr-only words. */
export function ShiftStatusPill({ status, compact }: { status: ShiftStatus; compact?: boolean }) {
  const tip = STATUS_TIP[status];
  return (
    <span class="status-pill tip" data-status={status === 'scheduled' ? 'upcoming' : status} data-compact={compact ? '' : undefined} data-tip={tip}>
      <i />{STATUS_LABEL[status]}<span class="sr-only">. {tip}</span>
    </span>
  );
}
