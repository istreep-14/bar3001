import { useEffect } from 'preact/hooks';
import type { Screen } from '../../router.ts';
import { Appearance } from './Appearance.tsx';
import { Roles } from './Roles.tsx';
import { SheetSync } from './SheetSync.tsx';
import { WageRates } from './WageRates.tsx';
import { YourData } from './YourData.tsx';
import styles from './SettingsScreen.module.css';

/* Settings is one page of sections: Hourly wage, Roles, Google Sheet, Appearance, Your data, one link in the side panel.
 * Each section is still a link of its own (#/settings/wages and so on); landing on one scrolls it to the top. The page is
 * made of separate parts (`parts`), so each section is its own card on the canvas rather than one card around them all;
 * the app header names the page. */
const AREAS: { page: Screen; id: string; title: string; body: () => preact.JSX.Element }[] = [
  { page: 'settings/wages', id: 'set-wages', title: 'Hourly wage', body: () => <WageRates /> },
  { page: 'settings/roles', id: 'set-roles', title: 'Roles', body: () => <Roles /> },
  { page: 'settings/sync', id: 'set-sync', title: 'Google Sheet', body: () => <SheetSync /> },
  { page: 'settings/look', id: 'set-look', title: 'Appearance', body: () => <Appearance /> },
  { page: 'settings/data', id: 'set-data', title: 'Your data', body: () => <YourData /> }
];

export function SettingsScreen({ page }: { page: Screen }) {
  useEffect(() => {
    const id = AREAS.find(a => a.page === page)?.id;
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [page]);
  return (
    <div class={`${styles.screen} parts`}>
      {AREAS.map(a => (
        <section key={a.id} id={a.id} class={styles.area} aria-labelledby={`${a.id}-h`} data-current={a.page === page && page !== 'settings/wages' ? '' : undefined}>
          <h2 id={`${a.id}-h`} class={styles.areaTitle}>{a.title}</h2>
          {a.body()}
        </section>
      ))}
    </div>
  );
}
