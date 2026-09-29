import { Icon } from './Icon.tsx';

/* The marks after a person's name, the way a chat app marks a server's owner and its moderators. Each is read out in words. */

/** "This is you": a gold crown. */
export function MeBadge() {
  return <span class="me-badge" title="You"><Icon name="crown" /><span class="sr-only"> (you)</span></span>;
}

/** A manager: a blue shield. */
export function ManagerBadge() {
  return <span class="me-badge" data-kind="manager" title="Manager"><Icon name="shield" /><span class="sr-only"> (manager)</span></span>;
}
