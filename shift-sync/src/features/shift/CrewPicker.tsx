import { useEffect, useId, useState } from 'preact/hooks';
import type { Staff } from '../../core/core.generated.js';
import { findPeople, rolesOf } from '../../lib/people.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { RoleTag } from '../../parts/RoleTag.tsx';
import { MeBadge } from '../../ui/MeBadge.tsx';
import styles from './CrewPicker.module.css';

/** Who worked a shift: type a name or a nickname and the roster filters as you type (`findPeople`), then tap to add or
 *  take them off. People already on the shift stay as chips above the field, so a search never hides how to remove them. */
export function CrewPicker({ people, selected, onAdd, onRemove }: {
  people: Staff[];
  selected: ReadonlySet<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const query = q.trim();
  // A blank field keeps the caller's order (you first). A query uses the shared match order, best first.
  const hits = query ? findPeople(people, query) : people.map(person => ({ person, score: 0, via: null as string | null }));
  useEffect(() => { setActive(0); }, [query]);

  const toggle = (id: string) => { if (selected.has(id)) onRemove(id); else onAdd(id); };
  const cursor = hits.length ? Math.min(active, hits.length - 1) : 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setActive(i => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Home' && hits.length) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && hits.length) { e.preventDefault(); setActive(hits.length - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();   // the picker sits inside the shift form; Enter adds a person, it does not save the shift
      const hit = hits[cursor];
      if (hit) toggle(hit.person.id);
    } else if (e.key === 'Escape' && q) {
      e.preventDefault();   // clear the search first; a second Escape (empty field) still closes the dialog
      setQ('');
    }
  };

  const chosen = people.filter(p => selected.has(p.id));
  return (
    <div class={styles.picker}>
      {chosen.length > 0 && (
        <ul class={styles.chips} aria-label="On this shift">
          {chosen.map(p => (
            <li key={p.id}>
              <button type="button" class={styles.chip} onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name} from this shift`}>
                <PersonAvatar id={p.id} fallback={p.name} />
                <span>{p.name}</span>{p.is_user && <MeBadge />}
                <span class={styles.x} aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input class={`input ${styles.search}`} type="search" placeholder="Name or nickname" autocomplete="off" role="combobox"
        aria-label="Find someone to add" aria-expanded={hits.length > 0} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={hits[cursor] ? `${listId}-${hits[cursor]!.person.id}` : undefined}
        value={q} onInput={e => setQ(e.currentTarget.value)} onKeyDown={onKey} />
      {query && hits.length === 0 ? <p class={styles.empty}>No one matches. Try a nickname.</p> : hits.length > 0 && (
        <ul class={styles.list} id={listId} role="listbox" aria-label="Roster">
          {hits.map((h, i) => {
            const p = h.person, on = selected.has(p.id), main = rolesOf(p).main;
            return (
              <li key={p.id} id={`${listId}-${p.id}`} role="option" aria-selected={on}>
                <button type="button" class={styles.row} data-on={on ? '' : undefined} data-active={i === cursor ? '' : undefined}
                  onMouseEnter={() => setActive(i)} onClick={() => toggle(p.id)}>
                  <PersonAvatar id={p.id} fallback={p.name} size="md" />
                  <span class={styles.who}>
                    <span class={styles.name}>{p.name}{p.is_user && <MeBadge />}{p.status === 'inactive' && <span class={styles.quiet}>Inactive</span>}</span>
                    {(main || h.via) && (
                      <span class={styles.meta}>
                        {main && <RoleTag name={main} quiet />}
                        {h.via && <span class={styles.via}>as “{h.via}”</span>}
                      </span>
                    )}
                  </span>
                  <span class={styles.state}>{on ? 'On shift' : 'Add'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
