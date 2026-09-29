import { Icon, isIconName } from './Icon.tsx';
import { swatchColor } from './swatches.ts';

/** A role: a small tinted square holding its icon in its colour (a dot when it has no icon), then its name as plain text.
 *  `quiet` is the lighter form for a person's other roles: the icon with no square, the name a step quieter. A role with no
 *  colour is grey. */
export function RoleBadge({ name, color, icon, quiet }: { name: string; color?: string | null; icon?: string | null; quiet?: boolean }) {
  const c = swatchColor(color);
  return (
    <span class="role" title={name} data-quiet={quiet ? '' : undefined} data-plain={c ? undefined : ''} style={c ? { '--rc': c.value } : undefined}>
      <span class="role-mark" aria-hidden="true">{isIconName(icon) ? <Icon name={icon} /> : <i />}</span><span class="role-name">{name}</span>
    </span>
  );
}
