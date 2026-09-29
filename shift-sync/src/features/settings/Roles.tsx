import { useState } from 'preact/hooks';
import type { Role } from '../../core/core.generated.js';
import { DEFAULT_ROLES, USUAL_ROLES as USUAL, unlistedRoles } from '../../data/roles.ts';
import { liveRoles, liveStaff, moveRole, removeRole, saveRole, undoRemoveRole } from '../../data/store.ts';
import { ColorPicker } from '../../ui/ColorPicker.tsx';
import { Icon, ROLE_ICONS } from '../../ui/Icon.tsx';
import { RoleBadge } from '../../ui/RoleBadge.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './SettingsScreen.module.css';

/** The roles people can have, top to bottom in rank (the way a server's role list reads; People sorts by it), each with a
 *  colour and an icon that show wherever the role does. Renaming a role renames it on everyone who has it. */
export function Roles() {
  const roles = liveRoles.value, loose = unlistedRoles();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => { try { setError(''); await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); } };
  const count = (r: string) => liveStaff.value.filter(p => [p.role, ...p.roles].some(x => x?.toLowerCase() === r.toLowerCase())).length;
  const add = (n: string, look?: { color: string; icon: string }) => run(async () => { await saveRole({ name: n, color: look?.color ?? null, icon: look?.icon ?? null }); });
  const usual = () => run(async () => { for (const n of Object.keys(USUAL)) if (!roles.some(r => r.name.toLowerCase() === n.toLowerCase())) await saveRole({ name: n, ...USUAL[n]! }); });

  return (
    <section class={styles.sec}>
      <p class={styles.p}>Top to bottom is rank: the People list sorts by it, highest first. A role's colour and icon show on its pill wherever it appears.</p>
      {error && <p class="error" role="alert">{error}</p>}
      {roles.length > 0 && (
        <div class={styles.roles}>
          {roles.map((r, i) => <RoleRow key={r.id} r={r} first={i === 0} last={i === roles.length - 1} people={count(r.name)} run={run} />)}
        </div>
      )}
      {roles.length === 0 && <p class={styles.p}>No roles set up yet. <button type="button" class="linkbtn" onClick={() => void usual()}>Add the usual roles</button> ({DEFAULT_ROLES.join(', ')}), or add your own.</p>}
      {loose.length > 0 && (
        <div class={styles.loose}>
          <span class="label-text">On people but not set up here</span>
          <div class={styles.looseList}>
            {loose.map(l => (
              <button key={l.name} type="button" class="btn btn-quiet" onClick={() => void add(l.name, USUAL[l.name])}>
                <Icon name="plus" /> {l.name} <span class="muted">· {l.people}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <form class={styles.addRole} onSubmit={e => { e.preventDefault(); if (name.trim()) void add(name.trim()).then(() => setName('')); }}>
        <input class="input" type="text" value={name} placeholder="New role" aria-label="New role" autocomplete="off" onInput={e => setName(e.currentTarget.value)} />
        <button type="submit" class="btn" disabled={!name.trim()}><Icon name="plus" /> Add role</button>
      </form>
    </section>
  );
}

/** One role: its pill, how many people have it, and its rank arrows; opened, its name, colour and icon. Each change saves. */
function RoleRow({ r, first, last, people, run }: { r: Role; first: boolean; last: boolean; people: number; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const save = (patch: Partial<Pick<Role, 'name' | 'color' | 'icon'>>) => run(() => saveRole({ id: r.id, name: r.name, color: r.color, icon: r.icon, sort: r.sort, ...patch }));
  const stop = (fn: () => void) => (e: Event) => { e.preventDefault(); e.stopPropagation(); fn(); };
  return (
    <details class={styles.role}>
      <summary>
        <RoleBadge name={r.name} color={r.color} icon={r.icon} />
        <span class="muted">{people} {people === 1 ? 'person' : 'people'}</span>
        <span class={styles.spacer} />
        <button type="button" class="btn btn-quiet btn-icon" aria-label={`Rank ${r.name} higher`} disabled={first} onClick={stop(() => void run(() => moveRole(r.id, -1)))}><Icon name="up" /></button>
        <button type="button" class="btn btn-quiet btn-icon" aria-label={`Rank ${r.name} lower`} disabled={last} onClick={stop(() => void run(() => moveRole(r.id, 1)))}><Icon name="down" /></button>
      </summary>
      <div class={styles.roleBody}>
        <label class="field"><span class="label-text">Name</span>
          <input class="input" type="text" value={r.name} key={r.name} autocomplete="off"
            onChange={e => { const n = e.currentTarget.value.trim(); if (n && n !== r.name) void save({ name: n }); }} />
          {people > 0 && <span class="hint">Renaming it renames it on {people === 1 ? 'the one person who has it' : `the ${people} people who have it`}.</span>}
        </label>
        <div class="field"><span class="label-text">Colour</span>
          <ColorPicker label={`${r.name} colour`} none="None" value={r.color} onChange={v => void save({ color: v })} />
        </div>
        <div class="field"><span class="label-text">Icon</span>
          <div class={styles.icons} role="radiogroup" aria-label={`${r.name} icon`}>
            <button type="button" role="radio" class={styles.iconPick} aria-checked={!r.icon} onClick={() => void save({ icon: null })}>None</button>
            {ROLE_ICONS.map(n => (
              <button type="button" role="radio" key={n} class={styles.iconPick} aria-checked={r.icon === n} aria-label={n} title={n} onClick={() => void save({ icon: n })}><Icon name={n} /></button>
            ))}
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-quiet" onClick={() => void run(async () => {
            const gone = await removeRole(r.id);
            if (gone) toast(`${gone.name} removed. People who have it keep it as plain text.`, { label: 'Undo', run: () => void undoRemoveRole(gone) });
          })}><Icon name="trash" /> Remove role</button>
        </div>
      </div>
    </details>
  );
}
