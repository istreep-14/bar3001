import { useEffect } from 'preact/hooks';
import { persisted } from './data/persisted.ts';
import { flipTheme, mode } from './data/settings.ts';
import { liveStaff, liveViews, ready } from './data/store.ts';
import { CalendarScreen } from './features/calendar/CalendarScreen.tsx';
import { DashboardScreen } from './features/dashboard/DashboardScreen.tsx';
import { HubCrew } from './features/hub/HubCrew.tsx';
import { HubIncome } from './features/hub/HubIncome.tsx';
import { HubWeek } from './features/hub/HubWeek.tsx';
import { LogScreen } from './features/log/LogScreen.tsx';
import { OverviewScreen } from './features/overview/OverviewScreen.tsx';
import { PeopleScreen } from './features/people/PeopleScreen.tsx';
import { PersonEditor } from './features/people/PersonEditor.tsx';
import { SettingsScreen } from './features/settings/SettingsScreen.tsx';
import { ShiftDrawer } from './features/shift/ShiftDrawer.tsx';
import { ShiftForm } from './features/shift/ShiftForm.tsx';
import { SummaryScreen } from './features/summary/SummaryScreen.tsx';
import { ShiftTable } from './features/table/ShiftTable.tsx';
import { drawerAsk, form, go, justNavigated, openForm, person, screen, sheet, sheetDate } from './router.ts';
import type { Screen } from './router.ts';
import { Icon } from './ui/Icon.tsx';
import type { IconName } from './ui/Icon.tsx';
import { MeCard } from './parts/MeCard.tsx';
import { SyncPill } from './parts/SyncPill.tsx';
import { TipLayer } from './ui/TipLayer.tsx';
import { Toaster } from './ui/toast.tsx';
import { isDesktop } from './ui/viewport.ts';
import styles from './app.module.css';

/* Shell = one side panel, then the page, each a rounded card on the canvas with the same fill. The panel is your card on
 * top, then every page in its group (Data, Roster, Setup) — a glyph, the name, a count on the right — and the theme switch
 * at its foot. The page card opens with a header: its name, a line about it, and the app's tools. A page made of separate
 * parts (Settings) drops the one card and gives each part its own. The drawer floats over the page's right edge while a
 * shift or person is open (it never resizes the page); a click anywhere outside it closes it. On a phone the groups are a
 * bottom tab bar and the group's pages a strip under the header. A page with two views gets a tab row. */
interface Tab { id: Screen; label: string }
/** A page in the side panel. `tabs` = one page with two views, each its own route (so still a link), switched from a tab row;
 *  `also` = other routes that belong to this page (the panel marks it current on them). `blurb` = the line under its name
 *  in the header; a page without one (the Setup sections, which are one scrolling page) is headed by its group. `icon` leads
 *  its link; `tag` is the count shown at the link's right, or null for none. */
interface Page { id: Screen; label: string; icon: IconName; tag?: () => string | number | null; blurb?: string; tabs?: Tab[]; also?: Screen[] }
interface Group { id: string; label: string; blurb: string; icon: IconName; pages: Page[] }
/* Data-first rail: three condensed tables, then roster and setup. Helper screens still resolve via the router. */
const GROUPS: Group[] = [
  { id: 'home', label: 'Home', blurb: 'Your week, your month and how the money is trending', icon: 'home', pages: [
    { id: 'dashboard', label: 'Home', icon: 'home', blurb: 'This week, tips per shift, and the last 7 days' },
    { id: 'hub/week', label: 'Plan week', icon: 'clock', blurb: 'Book the week and who works it, Monday to Sunday' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', blurb: 'Every shift on its day, shaded by how well it paid' },
    { id: 'overview', label: 'Insights', icon: 'trend', blurb: 'How your tips, rate and hours are trending' }] },
  { id: 'data', label: 'Data', blurb: 'Every shift, who you worked with, and what you made', icon: 'log', pages: [
    { id: 'table', label: 'Shifts', icon: 'table', tag: () => liveViews.value.length, blurb: 'Every shift with its hours, pay and crew' },
    { id: 'crew', label: 'Crew', icon: 'users', tag: () => liveViews.value.reduce((n, v) => n + v.crew.length, 0), blurb: 'Who worked each shift with you, and when' },
    { id: 'income', label: 'Income', icon: 'dollar', tag: () => liveViews.value.reduce((n, v) => n + (v.shift.tips != null ? 1 : 0) + (v.wage != null ? 1 : 0) + v.income.length + (v.shift.other ? 1 : 0), 0), blurb: 'Tips and every other line of pay, shift by shift' }] },
  { id: 'roster', label: 'Roster', blurb: 'The people you work with', icon: 'users', pages: [
    { id: 'people', label: 'People', icon: 'users', tag: () => liveStaff.value.length, blurb: 'Everyone you work with, their roles and status' }] },
  // Settings is one scrolling page of sections; its section routes (#/settings/roles, …) still land on it, scrolled there.
  { id: 'settings', label: 'Setup', blurb: 'Wages, roles, the Google Sheet, and how it looks', icon: 'settings', pages: [
    { id: 'settings/wages', label: 'Settings', icon: 'settings', blurb: 'Wages, roles, the Google Sheet, and how it looks',
      also: ['settings/roles', 'settings/sync', 'settings/look', 'settings/data'] }] }
];
const owns = (p: Page, s: Screen) => p.id === s || !!p.tabs?.some(t => t.id === s) || !!p.also?.includes(s);
/** Helper routes are not in the rail; still render them when an old link lands. */
const HELPERS: Screen[] = ['summary', 'log'];
/** The page each group was last on, so its phone tab goes back there rather than to the group's first page. */
const lastIn = new Map<string, Screen>();
const NAV_MIN = 10.5, NAV_MAX = 16.5, NAV_DEFAULT = 13;
const navOk = (v: unknown): v is number => typeof v === 'number' && v >= NAV_MIN && v <= NAV_MAX;
const [navRem, setNavRem] = persisted('nav-w', navOk, NAV_DEFAULT);

export function App() {
  const current = screen.value, desktop = isDesktop.value;
  const open = ready.value ? sheet.value : null, who = ready.value ? person.value : null, editing = ready.value ? form.value : null;
  const helper = HELPERS.includes(current);
  const group = GROUPS.find(g => g.pages.some(p => owns(p, current))) ?? GROUPS[0]!;
  const page = group.pages.find(p => owns(p, current));
  const solo = !helper && group.pages.length === 1;
  if (page && !helper) lastIn.set(group.id, current);
  // A helper screen is in no group: every tab leads out of it, and none is marked current.
  const tileTo = (g: Group) => (!helper && g.id === group.id ? current : lastIn.get(g.id) ?? g.pages[0]!.id);
  const navLink = (p: Page) => {
    const tag = p.tag?.();
    return (
      <a key={p.id} href={`#/${p.id}`} class={styles.navlink} aria-current={owns(p, current) ? 'page' : undefined} onClick={e => { e.preventDefault(); go(p.id); }}>
        <Icon name={p.icon} /><span class={styles.navlabel}>{p.label}</span>
        {tag != null && tag !== '' && tag !== 0 && <span class={styles.navtag}>{tag}</span>}
      </a>
    );
  };
  // On the Log and the Calendar (desktop) an open shift shows inside the page, so the floating drawer stays shut there.
  const inline = desktop && (current === 'log' || current === 'calendar') && !!open;
  const drawer = inline ? who : open ?? who;
  const floating = desktop && !!drawer;
  useEffect(() => {
    if (!floating) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t?.isConnected || t.closest('aside[aria-label="Detail"], dialog, [role="status"]') || justNavigated()) return;
      (drawerAsk.close ?? (() => {}))();
    };
    document.addEventListener('click', away);
    return () => document.removeEventListener('click', away);
  }, [floating]);
  return (
    <div class={styles.shell} style={{ '--side-w': `${navRem.value}rem` }}>
      <a class={styles.skip} href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <aside class={styles.side} aria-label="Navigation">
        <div class={styles.resize} role="separator" aria-orientation="vertical" aria-label="Nav width" aria-valuemin={NAV_MIN} aria-valuemax={NAV_MAX} aria-valuenow={navRem.value} tabIndex={0}
          onPointerDown={e => {
            if (e.button !== 0) return;
            e.preventDefault();
            const x0 = e.clientX, w0 = navRem.value;
            const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const move = (ev: PointerEvent) => setNavRem(Math.round(Math.min(NAV_MAX, Math.max(NAV_MIN, w0 + (ev.clientX - x0) / root)) * 4) / 4);
            const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onDblClick={() => setNavRem(NAV_DEFAULT)}
          onKeyDown={e => {
            const step = e.shiftKey ? 1 : 0.5;
            if (e.key === 'ArrowLeft') setNavRem(Math.round(Math.max(NAV_MIN, navRem.value - step) * 2) / 2);
            if (e.key === 'ArrowRight') setNavRem(Math.round(Math.min(NAV_MAX, navRem.value + step) * 2) / 2);
            if (e.key === 'Home') setNavRem(NAV_DEFAULT);
          }} />
        <div class={styles.me}><MeCard /></div>
        <nav class={styles.groups} aria-label="Pages">
          {GROUPS.map(g => (
            <div key={g.id} class={styles.group} role="group" aria-labelledby={`nav-${g.id}`}>
              <div id={`nav-${g.id}`} class={styles.gtitle}>{g.label}</div>
              {g.pages.map(navLink)}
            </div>
          ))}
        </nav>
        <div class={styles.sidefoot}>
          <button type="button" class={styles.navlink} onClick={flipTheme} aria-label={`Switch to ${mode() === 'dark' ? 'light' : 'dark'} theme`}>
            <Icon name={mode() === 'dark' ? 'sun' : 'moon'} /><span class={styles.navlabel}>{mode() === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      </aside>
      <nav class={styles.rail} aria-label="Main">
        <ul class={styles.links}>
          {GROUPS.map(g => (
            <li key={g.id}>
              <a href={`#/${tileTo(g)}`} class={styles.link} aria-current={!helper && g.id === group.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(tileTo(g)); }}>
                <Icon name={g.icon} /><span>{g.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div class={styles.main}>
        <header class={styles.head}>
          {!helper && (
            <div class={styles.heading}>
              <h1 class={styles.title}>{page?.blurb ? page.label : group.label}</h1>
              <p class={styles.blurb}>{page?.blurb ?? group.blurb}</p>
            </div>
          )}
          <div class={styles.tools}>
            <SyncPill />
            <button type="button" class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> New<span class={styles.long}> shift</span></button>
          </div>
        </header>
        {!solo && !helper && (
          <nav class={styles.strip} aria-label={`${group.label} pages`}>
            {group.pages.map(p => <a key={p.id} href={`#/${p.id}`} class={styles.stripLink} aria-current={owns(p, current) ? 'page' : undefined} onClick={e => { e.preventDefault(); go(p.id); }}>{p.label}</a>)}
          </nav>
        )}
        <main id="main" tabIndex={-1} class={styles.page}>
          {page?.tabs && (
            <nav class={styles.tabs} aria-label={`${page.label} views`}>
              {page.tabs.map(t => <a key={t.id} href={`#/${t.id}`} class={styles.tab} aria-current={current === t.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(t.id); }}>{t.label}</a>)}
            </nav>
          )}
          {current === 'dashboard' && <DashboardScreen />}
          {current === 'overview' && <OverviewScreen />}
          {current === 'calendar' && <CalendarScreen />}
          {current === 'log' && <LogScreen />}
          {current === 'table' && <ShiftTable />}
          {current === 'summary' && <SummaryScreen />}
          {current === 'hub/week' && <HubWeek />}
          {current === 'crew' && <HubCrew />}
          {current === 'income' && <HubIncome />}
          {current === 'people' && <PeopleScreen />}
          {current.startsWith('settings/') && <SettingsScreen page={current} />}
        </main>
      </div>

      {desktop && drawer && (
        <aside class={styles.drawer} aria-label="Detail"><div class={styles.card}>
          {open && !inline ? <ShiftDrawer key={open} id={open} host="panel" /> : <PersonEditor key={who!} id={who!} host="panel" />}
        </div></aside>
      )}
      {!desktop && open && <ShiftDrawer key={open} id={open} host="dialog" />}
      {!desktop && !open && who && <PersonEditor key={who} id={who} host="dialog" />}
      {editing && <ShiftForm key={editing + (sheetDateKey())} id={editing} />}
      <Toaster />
      <TipLayer />
    </div>
  );
}

/* `new` with a different pre-filled date is a different form: remount when the date changes. */
const sheetDateKey = () => sheetDate.value ?? '';
