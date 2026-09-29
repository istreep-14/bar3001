import { signal } from '@preact/signals';
import type { Local, Staff } from '../../core/core.generated.js';
import { liveRoles, liveStaff, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { DASH } from '../../lib/format.ts';
import { findPeople, rolesOf } from '../../lib/people.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { RoleTag } from '../../parts/RoleTag.tsx';
import { openPerson, person as openId } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { FilterMenu } from '../../ui/FilterMenu.tsx';
import type { Facet } from '../../ui/FilterMenu.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { StatList } from '../../ui/kpi.tsx';
import { ManagerBadge, MeBadge } from '../../ui/MeBadge.tsx';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { Table } from '../../ui/Table.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import type { Column } from '../../ui/Table.tsx';
import styles from './PeopleScreen.module.css';

const query = signal('');
const filters = signal<Filters>({});

/** What else a search looks in, past the names and aliases findPeople covers. */
const haystack = (p: Staff) => [p.id_number, p.notes, p.role, ...p.roles].filter(Boolean).join(' ').toLowerCase();

/** What the list can be filtered by. Values are what's stored; `labels` says how a value reads. */
const FIELDS: Record<string, { label: string; get: Field<Staff>; labels?: Record<string, string> }> = {
  role: { label: 'Role', get: p => rolesOf(p).main },
  others: { label: 'Other roles', get: p => rolesOf(p).others },
  status: { label: 'Status', get: p => p.status, labels: { active: 'Active', inactive: 'Inactive' } },
  manager: { label: 'Manager', get: p => (p.manager ? 'yes' : 'no'), labels: { yes: 'Manager', no: 'Not a manager' } },
  photo: { label: 'Photo', get: p => (p.photo ? 'yes' : 'no'), labels: { yes: 'Has a photo', no: 'No photo' } }
};

/* People: the employee roster, read like the Log (one line a person, the same head band, hover and selected row).
 * Identity only (no shift counts or hours, so it can't be read as a leaderboard). Not scoped: a person is not an event,
 * so there is no period control.
 *   Search: names and aliases first, the same rules as the crew picker (a name that starts with what's typed ranks above
 *   one that only contains it), then roles, ID and notes. A hit by nickname says which one. The best matches stay on top.
 *   Filter: any mix of role, other roles, status, manager and photo. */
export function PeopleScreen() {
  const all = liveStaff.value;
  const q = query.value.trim();
  const matches = q ? findPeople(all, q) : [];
  const score = new Map(matches.map(m => [m.person.id, m.score]));
  const viaOf = new Map(matches.flatMap(m => (m.via ? [[m.person.id, m.via] as const] : [])));
  const searched = q ? all.filter(p => score.has(p.id) || haystack(p).includes(q.toLowerCase())) : all;
  const fields = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.get]));
  const rows = applyFilters(searched, filters.value, fields);
  const roles = new Set(all.flatMap(p => [p.role, ...p.roles].filter(Boolean)));
  const facets: Facet[] = Object.entries(FIELDS).map(([key, f]) => ({
    key, label: f.label, options: facet(searched, f.get).map(o => ({ ...o, label: f.labels?.[o.value] }))
  }));

  const quiet = (v: string | null) => v || <span class="muted">{DASH}</span>;
  // Rank a person by their main role's place in Settings' list (Discord-style), then anyone whose role isn't set up there.
  const rank = new Map(liveRoles.value.map((r, i) => [r.name.toLowerCase(), i]));
  const rankOf = (p: Staff) => { const m = rolesOf(p).main; return m == null ? null : (rank.get(m.toLowerCase()) ?? 900) + m.toLowerCase(); };
  const no = <span class={styles.no}>No</span>;
  const columns: Column<Local<Staff>>[] = [
    { key: 'person', head: 'Person', weight: 2.4, sort: p => p.name.toLowerCase(), cell: p => <PersonCell p={p} via={viaOf.get(p.id)} /> },
    { key: 'role', head: 'Role', weight: 1.7, sort: rankOf, cell: p => {
      const { main, others } = rolesOf(p);
      return (
        <span class="cell-lines">
          {main ? <RoleTag name={main} /> : quiet(null)}
          {others.length > 0 && <span class="roles-sub">{others.map(r => <RoleTag key={r} name={r} quiet />)}</span>}
        </span>
      );
    } },
    { key: 'id', head: 'ID', weight: 0.9, sort: p => p.id_number, cell: p => (p.id_number ? <span class="idtag">#{p.id_number}</span> : quiet(null)) },
    { key: 'status', head: 'Status', weight: 1, sort: p => p.status, cell: p => <span class="status-pill" data-status={p.status}><i />{p.status === 'active' ? 'Active' : 'Inactive'}</span> },
    // Both marks are already after the name; these columns are there to sort by.
    { key: 'me', head: 'Me', weight: 0.7, sort: p => (p.is_user ? 1 : 0), cell: p => (p.is_user ? <span class={styles.flag}><MeBadge />You</span> : no) },
    { key: 'manager', head: 'Mgr', weight: 0.7, sort: p => (p.manager ? 1 : 0), cell: p => (p.manager ? <span class={styles.flag}><ManagerBadge />Mgr</span> : no) },
    { key: 'go', head: '', className: 'chev', cell: () => <Icon name="chevron" /> }
  ];

  const roster = ready.value && all.length === 0
    ? <EmptyState title="No one on the roster yet" action={<button class="btn btn-primary" onClick={() => openPerson('new')}><Icon name="plus" /> Add person</button>}>Add the people you work with. Each is a row you can edit, and it syncs to the Staff tab of your Sheet.</EmptyState>
    : <>
        <div class={styles.toolbar}>
          <input class={`input ${styles.search}`} type="search" placeholder="Search names, aliases, roles, ID, notes" aria-label="Search the roster"
            value={query.value} onInput={e => { query.value = e.currentTarget.value; }} />
          <FilterMenu facets={facets} value={filters.value} onChange={f => { filters.value = f; }} />
          <span class={styles.count}>{rows.length} of {all.length}</span>
        </div>
        {rows.length === 0
          ? <EmptyState title="No one matches">Clear the search or a filter.</EmptyState>
          : !isDesktop.value
            ? (
              <ul class={styles.list}>
                {[...rows].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0)).map(p => (
                  <li key={p.id}>
                    <button class={styles.item} data-tone={toneOf(p)} aria-current={openId.value === p.id ? 'true' : undefined} onClick={() => openPerson(p.id)}>
                      <PersonCell p={p} via={viaOf.get(p.id)} />
                      {rolesOf(p).main && <RoleTag name={rolesOf(p).main!} />}
                    </button>
                  </li>
                ))}
              </ul>
            )
            : <Table log fill paginate label="Roster" rows={rows} columns={columns} rowKey={p => p.id} onRow={p => openPerson(p.id)} selectedId={openId.value}
                tall tone={toneOf} rank={q ? p => score.get(p.id) ?? 0 : undefined}
                defaultSort={{ key: 'person', dir: 'asc' }} />}
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

/** How a person's row reads: yours first (even if you're also a manager, the crown's row wins), then greyed if inactive,
 *  then a manager's. */
const toneOf = (p: Staff) => (p.is_user ? 'me' : p.status === 'inactive' ? 'muted' : p.manager ? 'manager' : undefined);

/** A person in two lines: their avatar (framed in their colour, with the active/inactive dot); on top, the short name they go
 *  by in bold, a crown if it's you, a shield if they manage and their employee ID; under it, small, their first and last name. */
function PersonCell({ p, via }: { p: Staff; via?: string }) {
  const full = [p.first, p.last].filter(Boolean).join(' ');
  const sub = [full, via ? `as “${via}”` : ''].filter(Boolean).join(' · ');
  return (
    <span class="who">
      <PersonAvatar id={p.id} size="md" status />
      <span class="who-lines">
        <span class="who-top">
          <span class="who-name">{p.name}</span>{p.is_user && <MeBadge />}{p.manager && <ManagerBadge />}
          {p.id_number && <span class="idtag">#{p.id_number}</span>}
        </span>
        {sub && <span class="who-sub">{sub}</span>}
      </span>
    </span>
  );
}
