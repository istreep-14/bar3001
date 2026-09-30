import { computed, signal } from '@preact/signals';

/* Hash routing, so every state is a link and Back closes whatever opened, with no server rewrite rules.
 *   #/table  #/crew  #/income  #/people  #/settings/{look,wages,roles,sync,data}   the data pages
 *   Helper screens (dashboard, log, calendar, …) still resolve for old links; they are not the landing.
 *   ?shift=<id>                          the shift drawer (a read-only look), over ANY screen
 *   ?form=<id|new>[&date=YYYY-MM-DD][&page=crew]   the shift form dialog (add or edit); `date` pre-fills a new shift,
 *                                        `page` opens it on one of its pages (crew, misc...) instead of Overview
 *   ?person=<id|new>                     the person drawer (one drawer at a time) */
export type Screen = 'dashboard' | 'overview' | 'calendar' | 'log' | 'table' | 'summary' | 'crew' | 'income' | 'hub/week' | 'people'
  | 'settings/look' | 'settings/wages' | 'settings/roles' | 'settings/sync' | 'settings/data';
export const SCREENS: Screen[] = ['dashboard', 'overview', 'calendar', 'log', 'table', 'summary', 'crew', 'income', 'hub/week', 'people',
  'settings/look', 'settings/wages', 'settings/roles', 'settings/sync', 'settings/data'];
/** Links from before a page moved still land somewhere sensible. */
const LEGACY: Record<string, Screen> = {
  earnings: 'overview', rate: 'overview', settings: 'settings/sync',
  hub: 'crew', 'hub/crew': 'crew', 'hub/income': 'income', 'hub/week': 'hub/week',
  'log/multi': 'log', journal: 'log'
};

const read = () => location.hash.replace(/^#\/?/, '');
const raw = signal(read());
/* Back, or a plain link, that would leave an editor with unsaved changes asks first, the same as a move made in the app
 * (`go`, `push`) does. A hash change can't be cancelled, so "no" puts the editor's address back. */
let at = location.hash;
window.addEventListener('hashchange', () => {
  if (guard.dirty) {
    if (!confirm('Discard your changes?')) { history.pushState(null, '', at); return; }
    guard.dirty = false;
  }
  at = location.hash;
  raw.value = read();
});

const parsed = computed(() => {
  const [path = '', query = ''] = raw.value.split('?');
  return { path, q: new URLSearchParams(query) };
});

export const screen = computed<Screen>(() => {
  const p = parsed.value.path;
  return SCREENS.includes(p as Screen) ? (p as Screen) : LEGACY[p] ?? 'table';
});
/** A shift id, or null. */
export const sheet = computed<string | null>(() => parsed.value.q.get('shift'));
/** 'new', a shift id, or null. */
export const form = computed<string | null>(() => parsed.value.q.get('form'));
/** 'new', a person id, or null. */
export const person = computed<string | null>(() => parsed.value.q.get('person'));
export const sheetDate = computed<string | null>(() => parsed.value.q.get('date'));
/** The form page to open on, or null for its first. The form checks it is one of its own. */
export const formPage = computed<string | null>(() => parsed.value.q.get('page'));

const hash = (path: string, q?: Record<string, string>) => '#/' + path + (q ? '?' + new URLSearchParams(q) : '');

/** An open editor reports unsaved changes here so navigating away can ask first. */
export const guard = { dirty: false };
/** True when there is nothing unsaved, or you agree to drop it (which clears the flag, so the hash change that follows doesn't ask again). */
const discard = () => {
  if (!guard.dirty) return true;
  if (!confirm('Discard your changes?')) return false;
  guard.dirty = false;
  return true;
};

/** When the app last navigated on its own: a click outside the drawer that already navigated (a row, a rail link) shouldn't also close it. */
let navAt = 0;
export const justNavigated = () => performance.now() - navAt < 100;
/** The open panel drawer's own close request (asks first if it has unsaved edits); set by DrawerFrame. */
export const drawerAsk: { close: (() => void) | null } = { close: null };

export const go = (to: Screen) => { if (discard()) { navAt = performance.now(); openedInApp = false; location.hash = hash(to); } };

let openedInApp = false;
const push = (q: Record<string, string>) => {
  if (!discard()) return;
  navAt = performance.now();
  // Switching drawer to drawer replaces the entry, so Back (and the outside-click close) still lands on the bare screen.
  if ((sheet.value || person.value) && ('shift' in q || 'person' in q)) { location.replace(hash(screen.value, q)); return; }
  openedInApp = true;
  location.hash = hash(screen.value, q);
};
/** Opens the shift drawer for an existing shift, or the form for a new one (`date` pre-fills it: tap an empty day to add). */
/** Opening the shift that is already open closes it. */
export const openSheet = (id: string, date?: string) => (id === 'new' ? openForm('new', date) : id === sheet.value ? closeDrawer() : push({ shift: id }));
/** Opens the shift form: 'new', or an existing shift's id to edit it; `page` opens it on that page (the Crew page from the crew list). */
export const openForm = (id: string, date?: string, page?: string) => push({ form: id, ...(date ? { date } : {}), ...(page ? { page } : {}) });
export const openPerson = (id: string) => (id === person.value ? closeDrawer() : push({ person: id }));
/** In-app: pop the history entry the drawer or form pushed. Deep-linked: replace it with the bare screen. */
export const closeDrawer = () => {
  navAt = performance.now();
  if (openedInApp) { openedInApp = false; history.back(); } else location.replace(hash(screen.value));
};
export const closeSheet = closeDrawer;
