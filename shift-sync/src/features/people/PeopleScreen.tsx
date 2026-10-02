import { signal } from '@preact/signals';
import type { Local, Staff } from '../../core/core.generated.js';
import { liveRoles, liveStaff, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { findPeople, rolesOf } from '../../lib/people.ts';
import { PersonAvatar } from '../../parts/PersonAvatar.tsx';
import { RoleTag } from '../../parts/RoleTag.tsx';
import { openPerson, person as openId } from '../../router.ts';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { FilterMenu } from '../../ui/FilterMenu.tsx';
import type { Facet } from '../../ui/FilterMenu.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { ManagerBadge, MeBadge } from '../../ui/MeBadge.tsx';
import { SideStats } from '../../ui/SideStats.tsx';
import { Table } from '../../ui/Table.tsx';
import { SheetSearch } from '../../ui/SheetSearch.tsx';
import { TableTabs } from '../../ui/TableTabs.tsx';
import { isDesktop } from '../../ui/viewport.ts';
import type { Column } from '../../ui/Table.tsx';
import styles from './PeopleScreen.module.css';

const query = signal('');
const filters = signal<Filters>({});
/** The quick view: everyone, the active, the managers, or the inactive (tabs on the table). */
type View = 'all' | 'active' | 'managers' | 'inactive';
const view = signal<View>('all');
const inView = (p: Staff, w: View) => w === 'all' || (w === 'managers' ? p.manager : p.status === w);

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

/* People: the employee roster. Identity only (no shift counts or hours). The same data sheet as Shifts, Crew and Income
 * (search and filter over the table, the counts in the side column); its rows run two lines, a name over a role. */
export function PeopleScreen() {
  const all = liveStaff.value;
  const q = query.value.trim();
  const matches = q ? findPeople(all, q) : [];
  const score = new Map(matches.map(m => [m.person.id, m.score]));
  const viaOf = new Map(matches.flatMap(m => (m.via ? [[m.person.id, m.via] as const] : [])));
  const searched = q ? all.filter(p => score.has(p.id) || haystack(p).includes(q.toLowerCase())) : all;
  const fields = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.get]));
  const filtered = applyFilters(searched, filters.value, fields);
  const rows = filtered.filter(p => inView(p, view.value));
  const roles = new Set(all.flatMap(p => [p.role, ...p.roles].filter(Boolean)));
  const facets: Facet[] = Object.entries(FIELDS).map(([key, f]) => ({
    key, label: f.label, options: facet(searched, f.get).map(o => ({ ...o, label: f.labels?.[o.value] }))
  }));

  const rank = new Map(liveRoles.value.map((r, i) => [r.name.toLowerCase(), i]));
  const rankOf = (p: Staff) => { const m = rolesOf(p).main; return m == null ? null : (rank.get(m.toLowerCase()) ?? 900) + m.toLowerCase(); };
  const no = <span class={styles.no}>No</span>;
  const columns: Column<Local<Staff>>[] = [
    { key: 'person', head: 'Person', weight: 3, sort: p => p.name.toLowerCase(), cell: p => <PersonCell p={p} via={viaOf.get(p.id)} /> },
    { key: 'role', head: 'Role', weight: 1.5, sort: rankOf, cell: p => {
      const { main, others } = rolesOf(p);
      if (!main && others.length === 0) return '';
      return (
        <span class="cell-lines">
          {main && <RoleTag name={main} />}
          {others.length > 0 && <span class="roles-sub">{others.map(r => <RoleTag key={r} name={r} quiet />)}</span>}
        </span>
      );
    } },
    { key: 'id', head: 'ID', weight: 0.7, sort: p => p.id_number, cell: p => (p.id_number ? <span class="idtag">#{p.id_number}</span> : '') },
    { key: 'status', head: 'Status', weight: 1.05, sort: p => p.status, cell: p => <span class="status-pill" data-status={p.status}><i />{p.status === 'active' ? 'Active' : 'Inactive'}</span> },
    { key: 'me', head: 'Me', weight: 0.6, sort: p => (p.is_user ? 1 : 0), cell: p => (p.is_user ? <span class={styles.flag}><MeBadge />You</span> : no) },
    { key: 'manager', head: 'Mgr', weight: 0.6, sort: p => (p.manager ? 1 : 0), cell: p => (p.manager ? <span class={styles.flag}><ManagerBadge />Mgr</span> : no) },
    { key: 'go', head: '', className: 'chev when', fill: true, cell: () => <Icon name="chevron" /> }
  ];

  const roster = ready.value && all.length === 0
    ? <EmptyState title="No one on the roster yet" action={<button class="btn btn-primary" onClick={() => openPerson('new')}><Icon name="plus" /> Add person</button>}>Add the people you work with. Each is a row you can edit, and it syncs to the Staff tab of your Sheet.</EmptyState>
    : rows.length === 0
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
            : <Table log fill tall paginate label="Roster" rows={rows} columns={columns} rowKey={p => p.id} onRow={p => openPerson(p.id)} selectedId={openId.value}
                tone={toneOf} rank={q ? p => score.get(p.id) ?? 0 : undefined}
                defaultSort={{ key: 'person', dir: 'asc' }} />;

  // The view tabs stay over the table. Search, filter and add sit on that same row, as icon buttons.
  return (
    <section class="panel fill" aria-label="Roster table">
      <div class="split">
        <div class="tabbed">
          <TableTabs label="Who" value={view.value} onChange={v => { view.value = v; }}
            tabs={(['all', 'active', 'managers', 'inactive'] as const).map(w => ({ value: w, label: { all: 'All', active: 'Active', managers: 'Managers', inactive: 'Inactive' }[w], count: filtered.filter(p => inView(p, w)).length }))}
            tools={<>
              <span class="sheet-count">{rows.length} of {all.length}</span>
              <SheetSearch id="people-search" label="Search the roster" placeholder="Names, aliases, roles, ID, notes" value={query.value} onChange={v => { query.value = v; }} />
              <FilterMenu compact facets={facets} value={filters.value} onChange={f => { filters.value = f; }} />
              <button type="button" class="tool" data-tone="add" aria-label="Add person" title="Add person" onClick={() => openPerson('new')}><Icon name="plus" /></button>
            </>} />
          <div class={`data-sheet ${styles.body}`}>{roster}</div>
        </div>
        <SideStats label="On the roster" items={[
          { label: 'Employees', value: all.length },
          { label: 'Active', value: all.filter(p => p.status === 'active').length },
          { label: 'Managers', value: all.filter(p => p.manager).length },
          { label: 'Roles', value: roles.size }
        ]} />
      </div>
    </section>
  );
}

/** How a person's row reads: yours first (even if you're also a manager, the crown's row wins), then greyed if inactive,
 *  then a manager's. */
const toneOf = (p: Staff) => (p.is_user ? 'me' : p.status === 'inactive' ? 'muted' : p.manager ? 'manager' : undefined);

/** Two lines: the short name and marks on top, role/alias or legal name under, next to a large avatar. */
function PersonCell({ p, via }: { p: Staff; via?: string }) {
  const full = [p.first, p.last].filter(Boolean).join(' ');
  const extra = [
    rolesOf(p).main,
    full && full !== p.name ? full : '',
    via ? `as “${via}”` : ''
  ].filter(Boolean).join(' · ');
  return (
    <span class="who">
      <PersonAvatar id={p.id} size="md" status />
      <span class="who-lines">
        <span class="who-top">
          <span class="who-name">{p.name}</span>
          {p.is_user && <MeBadge />}
          {p.manager && <ManagerBadge />}
        </span>
        {extra && <span class="who-sub">{extra}</span>}
      </span>
    </span>
  );
}
