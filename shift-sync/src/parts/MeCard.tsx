import { liveViews, me } from '../data/store.ts';
import { rolesOf } from '../lib/people.ts';
import { go, openPerson } from '../router.ts';
import { Icon } from '../ui/Icon.tsx';
import { PersonAvatar } from './PersonAvatar.tsx';
import styles from './MeCard.module.css';

/** Whose shifts these are, at the head of the side panel (set like a workspace's name card): your face, your name, your role and how many shifts you've logged.
 *  Opens your own record. Before anyone on the roster is marked as you, it points at People to do that. */
export function MeCard() {
  const you = me.value, n = liveViews.value.length;
  if (!you) {
    return (
      <button type="button" class={styles.card} onClick={() => go('people')}>
        <span class={styles.blank} aria-hidden="true"><Icon name="users" /></span>
        <span class={styles.lines}><span class={styles.name}>Who are you?</span><span class={styles.sub}>Mark yourself in People</span></span>
      </button>
    );
  }
  const sub = [rolesOf(you).main, `${n} shift${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
  return (
    <button type="button" class={styles.card} onClick={() => openPerson(you.id)} aria-label={`${you.name}, ${sub}. Your details`}>
      <span class={styles.face} aria-hidden="true"><PersonAvatar id={you.id} size="md" /></span>
      <span class={styles.lines}><span class={styles.name}>{you.name}</span><span class={styles.sub}>{sub}</span></span>
    </button>
  );
}
