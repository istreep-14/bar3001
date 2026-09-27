import { useEffect, useRef, useState } from 'preact/hooks';
import type { Staff } from '../../core/core.generated.js';
import { knownRoles } from '../../data/roles.ts';
import { liveViews, personById, ready, removeStaff, saveStaff, undoRemoveStaff } from '../../data/store.ts';
import { DASH, clockPlain } from '../../lib/format.ts';
import { groupShifts, rowDay } from '../../lib/groups.ts';
import { closeDrawer, guard, openSheet } from '../../router.ts';
import { DrawerFrame } from '../../ui/DrawerFrame.tsx';
import type { FrameApi } from '../../ui/DrawerFrame.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from '../../ui/drawer.module.css';
import { StatusMark } from './StatusMark.tsx';

interface Form { name: string; first: string; last: string; roles: string[]; id_number: string; manager: boolean; is_user: boolean; status: 'active' | 'inactive'; notes: string }
const blank = (): Form => ({ name: '', first: '', last: '', roles: [], id_number: '', manager: false, is_user: false, status: 'active', notes: '' });
const fromPerson = (p: Staff): Form => ({ name: p.name, first: p.first ?? '', last: p.last ?? '', roles: p.roles, id_number: p.id_number ?? '', manager: p.manager, is_user: p.is_user, status: p.status, notes: p.notes ?? '' });
const orNull = (s: string) => s.trim() || null;
const fullName = (p: Staff) => [p.first, p.last].filter(Boolean).join(' ');

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
  const addRole = () => {
    const r = newRole.trim();
    if (r && !form.roles.some(x => x.toLowerCase() === r.toLowerCase())) set({ roles: [...form.roles, r] });
    setNewRole('');
  };

  async function submit(e: Event) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const f = form!;
      await saveStaff({ id: isNew ? undefined : id, name: f.name, first: orNull(f.first), last: orNull(f.last), roles: f.roles, id_number: orNull(f.id_number), manager: f.manager, is_user: f.is_user, status: f.status, notes: orNull(f.notes) });
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
      <div class={styles.title}>
        <h2 id="person-title" class="h-title">{p.name}</h2>
        <StatusMark status={p.status} />
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
          <div><dt>Roles</dt><dd>{p.roles.length ? p.roles.join(', ') : DASH}</dd></div>
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

  const roleOptions = knownRoles(form.roles);
  const edit = (
    <form class={styles.formBody} onSubmit={submit} noValidate>
      <div class={styles.body}>
        {error && <p class="error" role="alert">{error}</p>}
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
          <label class="field"><span class="label-text">ID number</span>
            <input class="input" type="text" value={form.id_number} autocomplete="off" onInput={e => set({ id_number: e.currentTarget.value })} /></label>
        </section>

        <section class={styles.section}>
          <div class="field" role="group" aria-label="Roles"><span class="label-text">Roles</span>
            <div class={styles.chips}>
              {roleOptions.map(r => <button key={r} type="button" class="tog" aria-pressed={form.roles.includes(r)} onClick={() => toggleRole(r)}>{r}</button>)}
            </div>
            <div class={styles.inline}>
              <input class="input" type="text" value={newRole} placeholder="Another role" aria-label="Add another role" autocomplete="off"
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
                <span class={styles.togetherDay}>{rowDay(v.shift.date, 'month')}</span>
                <span class="num">{clockPlain(c.start)} – {clockPlain(c.end)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
