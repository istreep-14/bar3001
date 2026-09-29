import { useEffect, useRef, useState } from 'preact/hooks';
import type { Staff } from '../../core/core.generated.js';
import { knownRoles } from '../../data/roles.ts';
import { liveViews, personById, ready, removeStaff, saveStaff, undoRemoveStaff } from '../../data/store.ts';
import { DASH, clockPlain } from '../../lib/format.ts';
import { groupShifts, rowDay } from '../../lib/groups.ts';
import { closeDrawer, go, guard, openSheet } from '../../router.ts';
import { handle, initials, rolesOf } from '../../lib/people.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { ColorPicker } from '../../ui/ColorPicker.tsx';
import { ManagerBadge, MeBadge } from '../../ui/MeBadge.tsx';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { RoleTag } from '../../parts/RoleTag.tsx';
import { DrawerFrame } from '../../ui/DrawerFrame.tsx';
import type { FrameApi } from '../../ui/DrawerFrame.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import { photoFromFile } from './photo.ts';
import styles from '../../ui/drawer.module.css';

interface Form {
  name: string; first: string; last: string; role: string; roles: string[]; id_number: string; manager: boolean; is_user: boolean; status: 'active' | 'inactive'; notes: string;
  aliases: string[]; photo: string | null; avatar_color: string | null; avatar_text: string;
}
const blank = (): Form => ({ name: '', first: '', last: '', role: '', roles: [], id_number: '', manager: false, is_user: false, status: 'active', notes: '', aliases: [], photo: null, avatar_color: null, avatar_text: '' });
const fromPerson = (p: Staff): Form => ({
  name: p.name, first: p.first ?? '', last: p.last ?? '', role: rolesOf(p).main ?? '', roles: rolesOf(p).others, id_number: p.id_number ?? '', manager: p.manager, is_user: p.is_user, status: p.status, notes: p.notes ?? '',
  aliases: p.aliases, photo: p.photo, avatar_color: p.avatar_color, avatar_text: p.avatar_text ?? ''
});
const orNull = (s: string) => s.trim() || null;

/* The person drawer: same contract as the shift drawer. Existing people open in view mode, the pencil edits,
 * a new person opens in edit. Identity only: no shift counts or hours (activity lives in the Log). */
export function PersonEditor({ id, host }: { id: string; host: 'panel' | 'dialog' }) {
  const frame = useRef<FrameApi | null>(null);
  const isNew = id === 'new';
  const existing = isNew ? undefined : personById(id);
  const [form, setForm] = useState<Form | null>(() => (isNew ? blank() : existing ? fromPerson(existing) : null));
  const [editing, setEditing] = useState(isNew);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const baseline = useRef(JSON.stringify(form));
  const dirty = form !== null && JSON.stringify(form) !== baseline.current;

  useEffect(() => { if (!form && ready.value) closeDrawer(); }, [form]);
  useEffect(() => { guard.dirty = dirty; return () => { guard.dirty = false; }; }, [dirty]);
  useEffect(() => { if (host === 'panel' && isNew) frame.current?.root()?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true }); }, [host]);
  if (!form) return null;

  const set = (patch: Partial<Form>) => setForm(f => f && { ...f, ...patch });
  const finish = () => { baseline.current = JSON.stringify(form); guard.dirty = false; frame.current?.close(); };
  const requestClose = () => { if (dirty && !confirm('Discard your changes?')) return; finish(); };
  const cancelEdit = () => {
    if (isNew) return requestClose();
    if (dirty && !confirm('Discard your changes?')) return;
    const f = fromPerson(existing!);
    baseline.current = JSON.stringify(f); guard.dirty = false;
    setForm(f); setError(''); setEditing(false);
  };
  const toggleRole = (r: string) => set({ roles: form.roles.includes(r) ? form.roles.filter(x => x !== r) : [...form.roles, r] });
  /** Picking a main role takes it out of the others (a role is one or the other). */
  const setMain = (r: string) => set({ role: r, roles: form.roles.filter(x => x.toLowerCase() !== r.toLowerCase()) });
  /** A typed role becomes the main one when there is none yet, else one of the others. */
  const addRole = () => {
    const r = newRole.replace(/\s+/g, ' ').replace(/,/g, '').trim();
    const have = [form.role, ...form.roles].some(x => x.toLowerCase() === r.toLowerCase());
    if (r && !have) { if (!form.role) setMain(r); else set({ roles: [...form.roles, r] }); }
    setNewRole('');
  };

  /** Adds what's typed as aliases (a comma separates several), skipping repeats and the name itself. */
  const addAlias = () => {
    const have = new Set([form.name, ...form.aliases].map(a => a.trim().toLowerCase()));
    const next = [...form.aliases];
    for (const a of newAlias.split(',').map(x => x.replace(/\s+/g, ' ').trim())) if (a && !have.has(a.toLowerCase())) { next.push(a); have.add(a.toLowerCase()); }
    set({ aliases: next });
    setNewAlias('');
  };

  async function submit(e: Event) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const f = form!;
      // An alias still in the box counts: typing one and pressing Save shouldn't lose it.
      const aliases = newAlias.trim() ? [...f.aliases, ...newAlias.split(',')] : f.aliases;
      await saveStaff({
        id: isNew ? undefined : id, name: f.name, first: orNull(f.first), last: orNull(f.last), role: orNull(f.role), roles: f.roles, id_number: orNull(f.id_number), manager: f.manager,
        is_user: f.is_user, status: f.status, notes: orNull(f.notes), aliases, photo: f.photo, avatar_color: f.avatar_color, avatar_text: orNull(f.avatar_text)
      });
      setNewAlias('');
      toast(isNew ? 'Person added' : 'Person saved');
      if (isNew) finish();
      else { const saved = personById(id); const nf = saved ? fromPerson(saved) : f; baseline.current = JSON.stringify(nf); guard.dirty = false; setForm(nf); setEditing(false); setSaving(false); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setSaving(false);
      queueMicrotask(() => frame.current?.root()?.querySelector<HTMLElement>('input')?.focus());
    }
  }

  async function remove() {
    const gone = await removeStaff(id);
    finish();
    if (gone) toast(`${gone.name} removed`, { label: 'Undo', run: () => void undoRemoveStaff(gone) });
  }

  const viewing = !editing && existing;
  const p = existing;

  const header = viewing && p ? (
    <header class={styles.head}>
      <div class={styles.personHead}>
        <PersonAvatar id={p.id} size="lg" status />
        <div class={styles.title}>
          <h2 id="person-title" class="h-title">{[p.first, p.last].filter(Boolean).join(' ') || p.name}{p.is_user && <MeBadge />}{p.manager && <ManagerBadge />}</h2>
          <span class={styles.handle}>{handle(p.name)} · {p.status === 'active' ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      <div class={styles.actions}>
        <button type="button" class="btn btn-quiet btn-icon" onClick={() => setEditing(true)} aria-label="Edit person"><Icon name="edit" /></button>
        <button type="button" class="btn btn-quiet btn-icon" onClick={() => void remove()} aria-label="Delete person"><Icon name="trash" /></button>
        <button type="button" class="btn btn-quiet btn-icon" onClick={requestClose} aria-label="Close"><Icon name="x" /></button>
      </div>
    </header>
  ) : (
    <header class={styles.head}>
      <h2 id="person-title" class="h-title">{isNew ? 'Add person' : 'Edit person'}</h2>
      <div class={styles.actions}>
        <button type="button" class="btn btn-quiet btn-icon" onClick={requestClose} aria-label="Close"><Icon name="x" /></button>
      </div>
    </header>
  );

  const yes = (b: boolean) => (b ? 'Yes' : DASH);
  const view = viewing && p ? (
    <div class={styles.body}>
      <section class={styles.section}>
        <dl class={styles.kv}>
          <div><dt>First name</dt><dd>{p.first ?? DASH}</dd></div>
          <div><dt>Last name</dt><dd>{p.last ?? DASH}</dd></div>
          <div><dt>Also known as</dt><dd>{p.aliases.length ? p.aliases.join(', ') : DASH}</dd></div>
          <div><dt>Main role</dt><dd>{rolesOf(p).main ? <RoleTag name={rolesOf(p).main!} /> : DASH}</dd></div>
          <div><dt>Other roles</dt><dd class="roles-line">{rolesOf(p).others.length ? rolesOf(p).others.map(r => <RoleTag key={r} name={r} quiet />) : DASH}</dd></div>
          <div><dt>ID number</dt><dd class="num">{p.id_number ?? DASH}</dd></div>
          <div><dt>Manager</dt><dd>{yes(p.manager)}</dd></div>
          <div><dt>This is me</dt><dd>{yes(p.is_user)}</dd></div>
        </dl>
      </section>
      {p.notes && <section class={styles.section}><p class={styles.notes}>{p.notes}</p></section>}
      <WorkedTogether id={p.id} me={p.is_user} />
      {p._dirty && <p class={styles.sync}>Not synced yet. It will sync when you're online.</p>}
    </div>
  ) : null;

  const roleOptions = knownRoles([form.role, ...form.roles].filter(Boolean));
  const otherOptions = roleOptions.filter(r => r.toLowerCase() !== form.role.toLowerCase());
  const edit = (
    <form class={styles.formBody} onSubmit={submit} noValidate>
      <div class={styles.body}>
        {error && <p class="error" role="alert">{error}</p>}
        <AvatarFields id={isNew ? 'new' : id} form={form} set={set} />

        <section class={styles.section}>
          <label class="field"><span class="label-text">Name</span>
            <input class="input" type="text" value={form.name} autocomplete="off" aria-invalid={!!error && !form.name.trim() && !form.first.trim()} onInput={e => set({ name: e.currentTarget.value })} />
            <span class="hint">The short name you use on the floor. Must be unique. Blank uses the first name.</span>
          </label>
          <div class={styles.two}>
            <label class="field"><span class="label-text">First name</span>
              <input class="input" type="text" value={form.first} autocomplete="off" onInput={e => set({ first: e.currentTarget.value })} /></label>
            <label class="field"><span class="label-text">Last name</span>
              <input class="input" type="text" value={form.last} autocomplete="off" onInput={e => set({ last: e.currentTarget.value })} /></label>
          </div>
          <div class="field" role="group" aria-label="Also known as"><span class="label-text">Also known as</span>
            {form.aliases.length > 0 && (
              <div class={styles.chips}>
                {form.aliases.map(a => (
                  <span key={a} class={`chip ${styles.alias}`}>{a}
                    <button type="button" aria-label={`Remove ${a}`} onClick={() => set({ aliases: form.aliases.filter(x => x !== a) })}><Icon name="x" /></button>
                  </span>
                ))}
              </div>
            )}
            <div class={styles.inline}>
              <input class="input" type="text" value={newAlias} placeholder="A nickname, a short name, a misspelling" aria-label="Add an alias" autocomplete="off"
                onInput={e => setNewAlias(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addAlias(); } }} />
              <button type="button" class="btn" onClick={addAlias} disabled={!newAlias.trim()}><Icon name="plus" /> Add</button>
            </div>
            <span class="hint">Other names they go by. Typing any of them finds this person.</span>
          </div>
          <label class="field"><span class="label-text">ID number</span>
            <input class="input" type="text" value={form.id_number} autocomplete="off" onInput={e => set({ id_number: e.currentTarget.value })} /></label>
        </section>

        <section class={styles.section}>
          <label class="field"><span class="label-text">Main role</span>
            <span class={styles.inline}>
              <select class="input" value={form.role} onChange={e => setMain(e.currentTarget.value)}>
                <option value="">None</option>
                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {form.role && <RoleTag name={form.role} />}
            </span>
            <span class="hint">The one shown by their name. Colours, icons and the order roles rank in are in <a href="#/settings/roles" onClick={e => { e.preventDefault(); go('settings/roles'); }}>Settings</a>.</span>
          </label>
          <div class="field" role="group" aria-label="Other roles"><span class="label-text">Other roles</span>
            <div class={styles.chips}>
              {otherOptions.map(r => <button key={r} type="button" class="tog" aria-pressed={form.roles.includes(r)} onClick={() => toggleRole(r)}>{r}</button>)}
            </div>
            <div class={styles.inline}>
              <input class="input" type="text" value={newRole} placeholder="A role not listed" aria-label="Add a role not listed" autocomplete="off"
                onInput={e => setNewRole(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }} />
              <button type="button" class="btn" onClick={addRole} disabled={!newRole.trim()}><Icon name="plus" /> Add</button>
            </div>
          </div>
          <div class="field" role="radiogroup" aria-label="Status"><span class="label-text">Status</span>
            <div class="seg">
              {(['active', 'inactive'] as const).map(s => (
                <label key={s}><input type="radio" name={`status-${host}`} checked={form.status === s} onChange={() => set({ status: s })} /><span>{s === 'active' ? 'Active' : 'Inactive'}</span></label>
              ))}
            </div>
          </div>
          <label class={styles.check}><input type="checkbox" checked={form.manager} onChange={e => set({ manager: e.currentTarget.checked })} /> Manager</label>
          <label class={styles.check}><input type="checkbox" checked={form.is_user} onChange={e => set({ is_user: e.currentTarget.checked })} /> This is me <span class={styles.hintInline}>(only one person can be)</span></label>
        </section>

        <section class={styles.section}>
          <label class="field"><span class="label-text">Notes</span>
            <textarea class="input" value={form.notes} onInput={e => set({ notes: e.currentTarget.value })} rows={3} /></label>
        </section>
      </div>
      <footer class={styles.foot}>
        <div class={styles.buttons}>
          <button type="submit" class="btn btn-primary" disabled={saving}>{isNew ? 'Add person' : 'Save changes'}</button>
          <button type="button" class="btn" onClick={cancelEdit}>Cancel</button>
        </div>
      </footer>
    </form>
  );

  return (
    <DrawerFrame host={host} labelledBy="person-title" requestClose={requestClose} apiRef={frame}>
      {header}{viewing ? view : edit}
    </DrawerFrame>
  );
}

/** The avatar: a photo, or letters on a colour. A photo covers the letters but they're kept, so removing the photo brings
 *  them back. A picked photo has its background taken out on the device, so their colour shows behind them; "Keep the
 *  background" puts the picked photo back as it was, and a photo that still has one can have it taken out. If the cut-out
 *  can't run (the first one needs a connection, to load it), the photo is kept as it is and says why. The preview is the
 *  avatar exactly as the tables will show it. */
function AvatarFields({ id, form, set }: { id: string; form: Form; set: (patch: Partial<Form>) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');           // what's being done to the photo, while it is
  const [cut, setCut] = useState(false);            // the photo shown is a cut-out made here
  const original = useRef<Blob | null>(null);       // what it was cut from, to put back
  const name = form.name.trim() || form.first.trim() || '?';
  const use = async (blob: Blob, cutout: boolean) => {
    setProblem(''); setBusy(cutout ? 'Taking the background out…' : 'Putting the photo back…');
    try {
      try {
        set({ photo: await photoFromFile(blob, { cutout }) }); setCut(cutout);
      } catch (err) {
        if (!cutout) throw err;
        set({ photo: await photoFromFile(blob) }); setCut(false);
        setProblem(`Couldn't take the background out${navigator.onLine ? '' : ' (the first time needs a connection)'}, so the photo is as it was.`);
      }
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not use that photo.');
    } finally { setBusy(''); }
  };
  const pick = (f: File | undefined) => { if (f) { original.current = f; void use(f, true); } };
  const removeBackground = async () => {
    const blob = original.current ?? (form.photo ? await (await fetch(form.photo)).blob() : null);
    if (blob) { original.current = blob; void use(blob, true); }
  };
  return (
    <section class={styles.section} aria-label="Avatar">
      <div class={styles.avatarEdit}>
        <Avatar id={id} name={name} look={{ photo: form.photo, avatar_color: form.avatar_color, avatar_text: form.avatar_text }} size="lg" />
        <div class={styles.avatarActions}>
          <input ref={file} type="file" accept="image/*" hidden onChange={e => { void pick(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
          <button type="button" class="btn" disabled={!!busy} onClick={() => file.current?.click()}><Icon name="plus" /> {form.photo ? 'Change photo' : 'Add photo'}</button>
          {form.photo && !busy && (cut && original.current
            ? <button type="button" class="btn btn-quiet" onClick={() => void use(original.current!, false)}>Keep the background</button>
            : !cut && form.photo.startsWith('data:image/jpeg') && <button type="button" class="btn btn-quiet" onClick={() => void removeBackground()}>Remove background</button>)}
          {form.photo && <button type="button" class="btn btn-quiet" disabled={!!busy} onClick={() => { set({ photo: null }); setCut(false); original.current = null; }}><Icon name="trash" /> Remove photo</button>}
          {busy && <span class={styles.hintInline} role="status">{busy}</span>}
        </div>
      </div>
      {problem && <p class="error" role="alert">{problem}</p>}
      <div class="field"><span class="label-text">Colour{form.photo && <span class={styles.hintInline}> (also behind a see-through photo)</span>}</span>
        <ColorPicker label="Avatar colour" none="Auto" value={form.avatar_color} onChange={v => set({ avatar_color: v })} />
      </div>
      <label class="field"><span class="label-text">Letters</span>
        <input class={`input ${styles.letters}`} type="text" maxLength={3} value={form.avatar_text} placeholder={initials(name)} autocomplete="off"
          onInput={e => set({ avatar_text: e.currentTarget.value })} />
        <span class="hint">Up to 3. Blank uses their initials.</span>
      </label>
    </section>
  );
}

/** The shifts this person was on, newest first, the month said once. Times only: no counts, hours or money, so the
 *  roster still can't be read as a leaderboard. You are on every shift you log, so your own card points to the Log. */
const TOGETHER_SHOWN = 10;
function WorkedTogether({ id, me }: { id: string; me: boolean }) {
  if (me) return <section class={styles.section}><h3 class="label">Shifts</h3><p class={styles.legacy}>Your shifts are all in the <a href="#/log">Log</a>.</p></section>;
  const views = liveViews.value.filter(v => v.crew.some(c => c.staff_id === id)).slice(0, TOGETHER_SHOWN);
  return (
    <section class={styles.section}>
      <h3 class="label">Worked together</h3>
      {views.length === 0 ? <p class={styles.legacy}>Not on any logged shift yet.</p> : groupShifts(views, 'month').map(g => (
        <div key={g.key} class={styles.together}>
          <h4 class={styles.togetherMonth}>{g.label}</h4>
          {g.views.map(v => {
            const c = v.crew.find(x => x.staff_id === id)!;
            return (
              <button type="button" key={v.shift.id} class={styles.togetherRow} onClick={() => openSheet(v.shift.id)}>
                <span class={styles.togetherDay}>{rowDay(v.shift.date)}</span>
                <span class="num">{clockPlain(c.start)} – {clockPlain(c.end)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
