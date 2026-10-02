import type { Crew } from '../core/core.generated.js';
import { hoursWorked } from '../core/core.generated.js';
import { personById } from '../data/store.ts';
import { DASH, dec1 } from '../lib/format.ts';
import { HoverCard } from '../ui/HoverCard.tsx';
import { MeBadge } from '../ui/MeBadge.tsx';
import { PersonAvatar } from './PersonAvatar.tsx';
import styles from './CrewStack.module.css';

const youFirst = (crew: Crew[]) => [...crew].sort((a, b) =>
  Number(!!personById(b.staff_id)?.is_user) - Number(!!personById(a.staff_id)?.is_user));

/** Faces for who was on a shift: you first, then the stored order, up to `max`, then +N.
 *  Hover or focus lists each person with their station and own hours. `sm` is the phone's 1.5rem. */
export function CrewStack({ crew, max = 3, sm, crewHours }: { crew: Crew[]; max?: number; sm?: boolean; crewHours?: number }) {
  if (!crew.length) return <span class="nil">{DASH}</span>;
  const ordered = youFirst(crew);
  const shown = ordered.slice(0, ordered.length > max ? max : ordered.length);
  const more = ordered.length - shown.length;
  const names = ordered.map(c => personById(c.staff_id)?.name ?? c.name).filter((n): n is string => !!n);
  const card = () => (
    <>
      {ordered.map(c => {
        const p = personById(c.staff_id);
        const h = hoursWorked(c.start, c.end);
        return (
          <span key={c.id} class={styles.who}>
            <PersonAvatar id={c.staff_id} fallback={c.name} />
            <span class={styles.whoName}>{p?.name ?? c.name ?? 'Someone'}{p?.is_user && <MeBadge />}</span>
            <span class={styles.whoSpot}>{c.location ?? ''}</span>
            <span class="fig">{h == null ? DASH : dec1(h)}</span>
          </span>
        );
      })}
      <span class={styles.foot}><span>{ordered.length} on the bar</span><b class="fig">{crewHours != null ? `${dec1(crewHours)}h` : ''}</b></span>
    </>
  );
  return (
    <HoverCard card={card} label={`${ordered.length} on the bar: ${names.join(', ')}`}>
      <span class={`avatars ${styles.faces}`} data-ring="" data-sm={sm ? '' : undefined}>
        {shown.map(c => <PersonAvatar key={c.id} id={c.staff_id} fallback={c.name} />)}
        {more > 0 && <span class="avatar avatar-more">+{more}</span>}
      </span>
    </HoverCard>
  );
}
