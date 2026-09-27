import { DASH, int, money } from '../lib/format.ts';
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

/** Tips per hour, flagged against the scope's own average. Arrow + color, never color alone.
 *  `whole` = table form: accounting-style $ and integer, with a reserved arrow slot so digits stay aligned. */
export function RatePill({ tph, tone, whole }: { tph: number | null; tone: 'good' | 'bad' | null; whole?: boolean }) {
  const hint = tone === 'good' ? ', above your average' : tone === 'bad' ? ', below your average' : '';
  if (whole) {
    if (tph == null) return <span class="cur rate"><span class="v">{DASH}</span><span class="slot" /></span>;
    return (
      <span class="cur rate" data-tone={tone ?? undefined} title={hint.slice(2) || undefined}>
        <span>$</span>
        <span class="rv"><span class="v">{int(tph)}</span><span class="slot">{tone && <Icon name={tone === 'good' ? 'up' : 'down'} />}</span></span>
        {tone && <span class="sr-only">{hint}</span>}
      </span>
    );
  }
  if (tph == null) return <span class="muted">{DASH}</span>;
  return (
    <span class="rate" data-tone={tone ?? undefined}>
      {tone && <Icon name={tone === 'good' ? 'up' : 'down'} />}
      {money(tph)}/hr
      {tone && <span class="sr-only">{hint}</span>}
    </span>
  );
}
