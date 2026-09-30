import { memo } from 'preact/compat';
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
 * the row, and sets --crew-h to that height so the right width is kept for the figures (CrewPhotos.module.css).
 *   Figures are memoized on the photo string, so a store refresh does not rebuild an image that did not change. */
export function CrewPhotos({ crew, more }: { crew: Crew[]; more: number }) {
  return (
    <span class={styles.frame} style={{ '--n': crew.length }}>
      <span class={styles.slot}>
        <span class={styles.group}>
          {crew.map((c, i) => {
            const p = personById(c.staff_id);
            const name = p?.name ?? c.name ?? '?';
            const z = crew.length - i;
            if (p?.photo) return <Photo key={c.id} name={name} photo={p.photo} z={z} />;
            const color = avatarColor(c.staff_id, p?.avatar_color);
            const fill = color.custom ? color.value : `color-mix(in srgb, ${color.value} 32%, var(--surface))`;
            const ink = color.custom ? onColor(color.value) : `color-mix(in srgb, ${color.value} 75%, var(--ink))`;
            return <Silhouette key={c.id} name={name} letters={initials(name, p?.avatar_text)} z={z} fill={color.auto ? `var(--avatar-bg, ${fill})` : fill} ink={color.auto ? `var(--avatar-ink, ${ink})` : ink} />;
          })}
        </span>
      </span>
      {more > 0 && <span class={styles.more}>+{more}</span>}
    </span>
  );
}

const Photo = memo(function Photo({ name, photo, z }: { name: string; photo: string; z: number }) {
  return <img class={styles.fig} data-opaque={photo.startsWith('data:image/jpeg') ? '' : undefined} src={photo} alt="" title={name} loading="lazy" decoding="async" style={{ zIndex: z }} />;
});

const Silhouette = memo(function Silhouette({ name, letters, z, fill, ink }: { name: string; letters: string; z: number; fill: string; ink: string }) {
  return (
    <svg class={styles.fig} viewBox="0 0 100 100" role="img" aria-label={name} style={{ zIndex: z, '--fill': fill, '--letters': ink }}>
      <title>{name}</title>
      <circle cx="50" cy="35" r="20" />
      <path d="M8 100C8 76 26 63 50 63S92 76 92 100Z" />
      <text x="50" y="88">{letters}</text>
    </svg>
  );
});
