import { signal } from '@preact/signals';

/* Layout breakpoint as state, for the few places that render different structure (not just different CSS). */
const mq = matchMedia('(min-width: 56rem)');
export const isDesktop = signal(mq.matches);
mq.addEventListener('change', e => { isDesktop.value = e.matches; });
