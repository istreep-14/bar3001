import type { Crew } from '../core/core.generated.js';
import { personById } from '../data/store.ts';
import { initials } from '../lib/people.ts';
import { onColor } from '../lib/theme.ts';
import { avatarColor } from '../ui/Avatar.tsx';
import styles from './CrewPhotos.module.css';

/* The crew as one group picture: each person's photo whole (not cut to a circle, no colour behind it), standing on the
 * row's bottom edge and reaching 80% of the way to its top, tucked a little behind the one to their left so the row's
 * people read as a single shot. The first stands in front. Then +N for anyone past those shown.
 *   A cut-out photo (its background taken out, a WebP or PNG) is used as it is. A photo that still has its background (a
 * JPEG) is shaped to an arch so it stands like a figure rather than a square. Someone with no photo is a head-and-shoulders
 * silhouette in their colour with their letters on the chest.
 *   The row is measured from the nearest positioned ancestor: the page makes the crew cell `position: relative`, as tall as
 * the row, and sets --crew-h to that height so the right width is kept for the figures (CrewPhotos.module.css). */
export function CrewPhotos({ crew, more }: { crew: Crew[]; more: number }) {
  return (
    <span class={styles.frame} style={{ '--n': crew.length }}>
      <span class={styles.slot}>
        <span class={styles.group}>
          {crew.map((c, i) => <Figure key={c.id} staffId={c.staff_id} fallback={c.name} z={crew.length - i} />)}
        </span>
      </span>
      {more > 0 && <span class={styles.more}>+{more}</span>}
    </span>
  );
}

function Figure({ staffId, fallback, z }: { staffId: string; fallback?: string | null; z: number }) {
  const p = personById(staffId), name = p?.name ?? fallback ?? '?';
  if (p?.photo) {
    return <img class={styles.fig} data-opaque={p.photo.startsWith('data:image/jpeg') ? '' : undefined} src={p.photo} alt="" title={name} style={{ zIndex: z }} />;
  }
  // no photo: the same colours an avatar would take (a hex exactly; else a tint of theirs, or the site-wide fill)
  const c = avatarColor(staffId, p?.avatar_color);
  const fill = c.custom ? c.value : `color-mix(in srgb, ${c.value} 32%, var(--surface))`;
  const ink = c.custom ? onColor(c.value) : `color-mix(in srgb, ${c.value} 75%, var(--ink))`;
  return (
    <svg class={styles.fig} viewBox="0 0 100 100" role="img" aria-label={name} style={{ zIndex: z, '--fill': c.auto ? `var(--avatar-bg, ${fill})` : fill, '--letters': c.auto ? `var(--avatar-ink, ${ink})` : ink }}>
      <title>{name}</title>
      <circle cx="50" cy="35" r="20" />
      <path d="M8 100C8 76 26 63 50 63S92 76 92 100Z" />
      <text x="50" y="88">{initials(name, p?.avatar_text)}</text>
    </svg>
  );
}
