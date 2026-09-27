import { signal } from '@preact/signals';
import type { Local, Staff } from '../../core/core.generated.js';
import { liveStaff, ready } from '../../data/store.ts';
import { DASH } from '../../lib/format.ts';
import { openPerson, person as openId } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { Stack } from '../../ui/Stack.tsx';
import { Table } from '../../ui/Table.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import type { Column } from '../../ui/Table.tsx';
import { StatusMark } from './StatusMark.tsx';
import styles from './PeopleScreen.module.css';

type Filter = 'all' | 'active' | 'inactive';
const filter = signal<Filter>('all');
const query = signal('');

const haystack = (p: Staff) => [p.name, p.first, p.last, p.id_number, p.notes, ...p.roles].filter(Boolean).join(' ').toLowerCase();

/* People: the employee roster as a database. Identity only (no shift counts or hours, so it can't be read
 * as a leaderboard). Not scoped: a person is not an event, so there is no period control. */
export function PeopleScreen() {
  const all = liveStaff.value;
  const q = query.value.trim().toLowerCase();
  const rows = all.filter(p => (filter.value === 'all' || p.status === filter.value) && (!q || haystack(p).includes(q)));
  const roles = new Set(all.flatMap(p => p.roles));

  const who = (p: Local<Staff>) => [p.first, p.last].filter(Boolean).join(' ');
  const columns: Column<Local<Staff>>[] = [
    { key: 'name', head: 'Person', sort: p => p.name, cell: p => (
      <Stack title={<>{p.name}{p.is_user && <span class="stack-meta"> · you</span>}</>} lines={[who(p) || (p.id_number ? '' : DASH), p.id_number ? `ID ${p.id_number}` : '']} />
    ) },
    { key: 'roles', head: 'Role', sort: p => p.roles.join(', '), cell: p => (
      <Stack title={p.roles.length ? p.roles.join(', ') : DASH} lines={[p.manager ? 'Manager' : '']} />
    ) },
    { key: 'status', head: 'Status', className: 'fit', sort: p => p.status, cell: p => <StatusMark status={p.status} /> },
    { key: 'notes', head: 'Notes', className: 'notes', sort: p => p.notes, cell: p => p.notes || <span class="muted">{DASH}</span> }
  ];

  const roster = ready.value && all.length === 0
    ? <EmptyState title="No one on the roster yet" action={<button class="btn btn-primary" onClick={() => openPerson('new')}><Icon name="plus" /> Add person</button>}>Add the people you work with. Each is a row you can edit, and it syncs to the Staff tab of your Sheet.</EmptyState>
    : <>
        <div class={styles.toolbar}>
          <input class={`input ${styles.search}`} type="search" placeholder="Search name, role, ID, notes" aria-label="Search the roster"
            value={query.value} onInput={e => { query.value = e.currentTarget.value; }} />
          <div class="seg" role="radiogroup" aria-label="Status">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <label key={f}><input type="radio" name="people-status" checked={filter.value === f} onChange={() => { filter.value = f; }} /><span>{f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}</span></label>
            ))}
          </div>
          <span class={styles.count}>{rows.length} of {all.length}</span>
        </div>
        {rows.length === 0
          ? <EmptyState title="No one matches">Clear the search or switch the status filter.</EmptyState>
          : !isDesktop.value
            ? (
              <ul class={styles.list}>
                {rows.map(p => (
                  <li key={p.id}>
                    <button class={styles.item} aria-current={openId.value === p.id ? 'true' : undefined} onClick={() => openPerson(p.id)}>
                      <span class={styles.main}>
                        <span class={styles.name}>{p.name}{p.manager && <span class={styles.mgr}>Manager</span>}{p.is_user && <span class={styles.mgr}>Me</span>}</span>
                        <span class={styles.sub}>{[who(p), p.roles.join(', ')].filter(Boolean).join(' · ') || DASH}</span>
                      </span>
                      <StatusMark status={p.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )
            : <Table fill paginate label="Roster" rows={rows} columns={columns} rowKey={p => p.id} onRow={p => openPerson(p.id)} selectedId={openId.value}
                defaultSort={{ key: 'name', dir: 'asc' }} />}
      </>;

  return (
    <section class="panel fill" aria-labelledby="people-title">
      <PanelHead title="People" id="people-title"><button class="btn btn-primary" onClick={() => openPerson('new')}><Icon name="plus" /> Add<span class={styles.long}> person</span></button></PanelHead>
      <div class="split">
        <div class={`panel-body flush ${styles.body}`}>{roster}</div>
        <aside class="panel-body side" aria-label="Roster">
          <div class="side-block">
            <h3 class="label">Roster</h3>
            <StatList items={[
              { label: 'Employees', value: all.length },
              { label: 'Active', value: all.filter(p => p.status === 'active').length },
              { label: 'Managers', value: all.filter(p => p.manager).length },
              { label: 'Roles', value: roles.size }
            ]} />
          </div>
        </aside>
      </div>
    </section>
  );
}
