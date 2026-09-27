import { liveStaff } from './store.ts';

/** Suggested roles. Free text is allowed, and any role already on someone stays in the list. */
export const DEFAULT_ROLES = ['Bartender', 'Head Bartender', 'Server', 'Barback', 'Host', 'Manager'];

export const knownRoles = (extra: string[] = []): string[] => {
  const seen = new Set<string>(DEFAULT_ROLES);
  for (const p of liveStaff.value) p.roles.forEach(r => seen.add(r));
  extra.forEach(r => seen.add(r));
  return [...seen].sort((a, b) => a.localeCompare(b));
};
