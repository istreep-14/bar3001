import { liveRoles, liveStaff } from './store.ts';

/** The usual roles, top rank first, each with a colour and an icon to start from: what Settings' "Add the usual roles" sets
 *  up, and the suggestions until Settings has its own list. Free text is allowed, and any role already on someone stays. */
export const USUAL_ROLES: Record<string, { color: string; icon: string }> = {
  'Head Bartender': { color: 'gold', icon: 'star' }, Bartender: { color: 'teal', icon: 'cocktail' }, Server: { color: 'blue', icon: 'bell' },
  Barback: { color: 'orange', icon: 'box' }, Host: { color: 'violet', icon: 'door' }, Manager: { color: 'rose', icon: 'shield' }
};
export const DEFAULT_ROLES = Object.keys(USUAL_ROLES);

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
