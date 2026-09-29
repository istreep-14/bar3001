import { liveRoles, liveStaff } from './store.ts';

/** Suggested roles until Settings has its own list. Free text is allowed, and any role already on someone stays in the list. */
export const DEFAULT_ROLES = ['Bartender', 'Head Bartender', 'Server', 'Barback', 'Host', 'Manager'];

/** The roles to offer: Settings' list in rank order first, then any other role someone has (or the suggestions while the list
 *  is empty), A to Z. One entry per name, whatever its case. */
export const knownRoles = (extra: string[] = []): string[] => {
  const set = liveRoles.value.map(r => r.name), seen = new Set(set.map(r => r.toLowerCase()));
  const rest = new Map<string, string>();
  const add = (r: string) => { const k = r.toLowerCase(); if (r && !seen.has(k) && !rest.has(k)) rest.set(k, r); };
  if (!set.length) DEFAULT_ROLES.forEach(add);
  for (const p of liveStaff.value) { if (p.role) add(p.role); p.roles.forEach(add); }
  extra.forEach(add);
  return [...set, ...[...rest.values()].sort((a, b) => a.localeCompare(b))];
};

/** Roles someone has that Settings' list doesn't know yet (no colour, no icon), with how many people have each. */
export const unlistedRoles = (): { name: string; people: number }[] => {
  const listed = new Set(liveRoles.value.map(r => r.name.toLowerCase())), out = new Map<string, { name: string; people: number }>();
  for (const p of liveStaff.value) for (const r of new Set([p.role, ...p.roles].filter((x): x is string => !!x))) {
    const k = r.toLowerCase();
    if (listed.has(k)) continue;
    const e = out.get(k) ?? { name: r, people: 0 };
    e.people++; out.set(k, e);
  }
  return [...out.values()].sort((a, b) => b.people - a.people || a.name.localeCompare(b.name));
};
