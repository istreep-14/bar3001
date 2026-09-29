import { personById } from '../data/store.ts';
import { Avatar } from '../ui/Avatar.tsx';
import type { AvatarSize } from '../ui/Avatar.tsx';

/** A roster person's avatar by id, with their photo, colour and letters. `fallback` names someone no longer on the roster;
 *  `status` puts their active/inactive dot on it. */
export function PersonAvatar({ id, fallback, size, status }: { id: string; fallback?: string | null; size?: AvatarSize; status?: boolean }) {
  const p = personById(id);
  return <Avatar id={id} name={p?.name ?? fallback ?? '?'} look={p} size={size} status={status ? p?.status : undefined} />;
}
