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
