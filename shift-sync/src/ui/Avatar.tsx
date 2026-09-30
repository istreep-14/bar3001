import { useEffect, useState } from 'preact/hooks';
import { memo } from 'preact/compat';
import { thumbNow, thumbUrl } from './avatarThumb.ts';
import { hashOf, initials } from '../lib/people.ts';
import { onColor } from '../lib/theme.ts';
import { SWATCHES, swatchColor } from './swatches.ts';

/** Who hasn't picked a colour gets one of these from their id (green reads as "good" and gold is yours, so neither). */
const AUTO = SWATCHES.filter(c => c.id !== 'green' && c.id !== 'gold');

/** What a person can set on their avatar. All optional: with none, it is their initials in a colour picked from their id. */
export interface AvatarLook { photo?: string | null; avatar_color?: string | null; avatar_text?: string | null }

/** The colour an avatar paints with: a hex the person chose, one of the named colours, or one picked from the id (`auto`,
 *  which the site-wide avatar fill in Settings stands in for when there is one). */
export function avatarColor(id: string, color?: string | null): { value: string; custom: boolean; auto: boolean } {
  const own = swatchColor(color);
  return own ? { ...own, auto: false } : { value: `var(${AUTO[hashOf(id) % AUTO.length]!.token})`, custom: false, auto: true };
}

/** A person's circle: their photo when they have one, else their letters on their colour. `status` adds a dot on its
 *  lower right edge, green for active and red for inactive (the word goes with it for anyone who can't tell them apart).
 *  List sizes share a 48px thumb; `lg` (the drawer) uses the stored photo so the circle is not an upscaled thumbnail. */
export type AvatarSize = 'sm' | 'md' | 'lg';
export const Avatar = memo(function Avatar({ id, name, look, size = 'sm', status }: { id: string; name: string; look?: AvatarLook; size?: AvatarSize; status?: 'active' | 'inactive' }) {
  const c = avatarColor(id, look?.avatar_color);
  const photo = look?.photo || null;
  const [src, setSrc] = useState<string | null>(() => (photo ? (size === 'lg' ? photo : thumbNow(id, photo) ?? null) : null));
  useEffect(() => {
    if (!photo) { setSrc(null); return; }
    if (size === 'lg') { setSrc(photo); return; }
    const hit = thumbNow(id, photo);
    if (hit) { setSrc(hit); return; }
    setSrc(null);
    let live = true;
    void thumbUrl(id, photo).then(url => { if (live) setSrc(url); });
    return () => { live = false; };
  }, [id, photo, size]);
  // a colour picked by hex is painted exactly, with black or white letters, whichever reads better on it
  const ink = c.custom ? onColor(c.value) : null;
  const circle = (
    <span class="avatar" data-size={size === 'sm' ? undefined : size} data-custom={c.custom ? '' : undefined} data-auto={c.auto ? '' : undefined} data-photo={photo ? '' : undefined}
      style={{ '--ac': c.value, ...(ink ? { '--ac-ink': ink } : {}) }} title={name} role="img" aria-label={name}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : initials(name, look?.avatar_text)}
    </span>
  );
  if (!status) return circle;
  return (
    <span class="avatar-wrap" data-size={size === 'sm' ? undefined : size}>
      {circle}<i class="avatar-dot" data-status={status} title={status === 'active' ? 'Active' : 'Inactive'} />
    </span>
  );
});
