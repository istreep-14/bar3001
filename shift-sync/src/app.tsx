import { useEffect } from 'preact/hooks';
import { flipTheme, mode } from './data/settings.ts';
import { ready } from './data/store.ts';
import { CalendarScreen } from './features/calendar/CalendarScreen.tsx';
import { JournalScreen } from './features/journal/JournalScreen.tsx';
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
import { drawerAsk, form, go, justNavigated, openForm, person, screen, sheet } from './router.ts';
import type { Screen } from './router.ts';
import { Icon } from './ui/Icon.tsx';
import type { IconName } from './ui/Icon.tsx';
import { SyncPill } from './ui/SyncPill.tsx';
import { Toaster } from './ui/toast.tsx';
import { isDesktop } from './ui/viewport.ts';
import styles from './app.module.css';

/* Shell = a two-tier rail (groups, then the group's pages) · main. The drawer floats over the page's right edge while a
 * shift or person is open (it never resizes the page); a click anywhere outside it closes it. A group with one page has no second tier. On a phone the six pages are a bottom tab bar. */
interface Page { id: Screen; label: string; icon: IconName }
interface Group { id: string; label: string; icon: IconName; pages: Page[] }
const GROUPS: Group[] = [
  { id: 'shift', label: 'Shift', icon: 'log', pages: [
    { id: 'overview', label: 'Overview', icon: 'chart' }, { id: 'calendar', label: 'Calendar', icon: 'calendar' }, { id: 'journal', label: 'Journal', icon: 'cards' },
    { id: 'log', label: 'Log', icon: 'table' }, { id: 'summary', label: 'Summary', icon: 'trend' }] },
  { id: 'hub', label: 'Hub', icon: 'table', pages: [
    { id: 'hub/week', label: 'Crew week', icon: 'calendar' }, { id: 'hub/crew', label: 'Crew log', icon: 'users' }, { id: 'hub/income', label: 'Other income', icon: 'dollar' }] },
  { id: 'people', label: 'People', icon: 'users', pages: [{ id: 'people', label: 'People', icon: 'users' }] },
  { id: 'settings', label: 'Settings', icon: 'settings', pages: [
    { id: 'settings/look', label: 'Appearance', icon: 'sun' }, { id: 'settings/wages', label: 'Hourly wage', icon: 'dollar' },
    { id: 'settings/sync', label: 'Google Sheet', icon: 'refresh' }, { id: 'settings/data', label: 'Your data', icon: 'download' }] }
];

export function App() {
  const current = screen.value, desktop = isDesktop.value;
  const open = ready.value ? sheet.value : null, who = ready.value ? person.value : null, editing = ready.value ? form.value : null;
  const group = GROUPS.find(g => g.pages.some(p => p.id === current))!;
  const solo = group.pages.length === 1;
  const drawer = open ?? who;
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
    <div class={styles.shell} data-solo={solo ? '' : undefined}>
      <a class={styles.skip} href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <nav class={styles.rail} aria-label="Main">
        <div class={styles.rail1}>
          <span class={styles.brand} title="Shifts"><b aria-hidden="true">SH</b><span aria-hidden="true">Shifts</span><span class="sr-only">Shifts</span></span>
          <div class={styles.gtiles}>
            {GROUPS.map(g => (
              <a key={g.id} href={`#/${g.pages[0]!.id}`} class={styles.gtile} aria-current={g.id === group.id ? 'true' : undefined}
                onClick={e => { e.preventDefault(); go(g.id === group.id ? current : g.pages[0]!.id); }}>
                <Icon name={g.icon} />{g.label}
              </a>
            ))}
          </div>
          <button type="button" class={`${styles.gtile} ${styles.newtile}`} onClick={() => openForm('new')}><Icon name="plus" />New</button>
          <div class={styles.syncslot}><SyncPill compact /></div>
          <button type="button" class={`${styles.gtile} ${styles.themetile}`} onClick={flipTheme} aria-label={`Switch to ${mode() === 'dark' ? 'light' : 'dark'} theme`}>
            <Icon name={mode() === 'dark' ? 'sun' : 'moon'} />{mode() === 'dark' ? 'Light' : 'Dark'}
          </button>
          <ul class={styles.links}>
            {GROUPS.map(g => (
              <li key={g.id}>
                <a href={`#/${g.pages[0]!.id}`} class={styles.link} aria-current={g.id === group.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(g.id === group.id ? current : g.pages[0]!.id); }}>
                  <Icon name={g.icon} /><span>{g.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div class={styles.rail2}>
          <h2 class={`${styles.gtitle} label`}>{group.label}</h2>
          <div class={styles.pages}>
            {group.pages.map(p => (
              <a key={p.id} href={`#/${p.id}`} class={styles.pagelink} aria-current={current === p.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(p.id); }}>{p.label}</a>
            ))}
          </div>
        </div>
      </nav>

      <div class={styles.main}>
        <header class={styles.topbar}>
          <SyncPill />
          <button class="btn btn-primary" onClick={() => openForm('new')}><Icon name="plus" /> New<span class={styles.long}> shift</span></button>
        </header>
        {!solo && (
          <nav class={styles.strip} aria-label={group.label}>
            {group.pages.map(p => <a key={p.id} href={`#/${p.id}`} class={styles.stripLink} aria-current={current === p.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(p.id); }}>{p.label}</a>)}
          </nav>
        )}
        <main id="main" tabIndex={-1} class={styles.page}>
          {current === 'overview' && <OverviewScreen />}
          {current === 'calendar' && <CalendarScreen />}
          {current === 'journal' && <JournalScreen />}
          {current === 'log' && <LogScreen />}
          {current === 'summary' && <SummaryScreen />}
          {current === 'hub/week' && <HubWeek />}
          {current === 'hub/crew' && <HubCrew />}
          {current === 'hub/income' && <HubIncome />}
          {current === 'people' && <PeopleScreen />}
          {current.startsWith('settings/') && <SettingsScreen page={current} />}
        </main>
      </div>

      {desktop && drawer && (
        <aside class={styles.drawer} aria-label="Detail"><div class={styles.card}>
          {open ? <ShiftDrawer key={open} id={open} host="panel" /> : <PersonEditor key={who!} id={who!} host="panel" />}
        </div></aside>
      )}
      {!desktop && open && <ShiftDrawer key={open} id={open} host="dialog" />}
      {!desktop && !open && who && <PersonEditor key={who} id={who} host="dialog" />}
      {editing && <ShiftForm key={editing + (sheetDateKey())} id={editing} />}
      <Toaster />
    </div>
  );
}

/* `new` with a different pre-filled date is a different form: remount when the date changes. */
import { sheetDate } from './router.ts';
const sheetDateKey = () => sheetDate.value ?? '';
