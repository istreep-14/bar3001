import { roleByName } from '../data/store.ts';
import { RoleBadge } from '../ui/RoleBadge.tsx';

/** A role by name, in the colour and icon Settings gives it (plain grey if it isn't set up there). */
export function RoleTag({ name, quiet }: { name: string; quiet?: boolean }) {
  const r = roleByName(name);
  return <RoleBadge name={r?.name ?? name} color={r?.color} icon={r?.icon} quiet={quiet} />;
}
