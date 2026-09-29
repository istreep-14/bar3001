import { useEffect } from 'preact/hooks';
import type { Screen } from '../../router.ts';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { Appearance } from './Appearance.tsx';
import { Roles } from './Roles.tsx';
import { SheetSync } from './SheetSync.tsx';
import { WageRates } from './WageRates.tsx';
import { YourData } from './YourData.tsx';
import styles from './SettingsScreen.module.css';

/* Settings is one page of sections: Hourly wage, Roles, Google Sheet, Appearance, Your data. The second rail still links each
 * one (#/settings/wages and so on); following a link scrolls its section to the top, so every setting stays a link. */
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
    <section class="panel" aria-labelledby="settings-title">
      <PanelHead title="Settings" id="settings-title" />
      <div class={`panel-body ${styles.screen}`}>
        {AREAS.map(a => (
          <section key={a.id} id={a.id} class={styles.area} aria-labelledby={`${a.id}-h`} data-current={a.page === page ? '' : undefined}>
            <h2 id={`${a.id}-h`} class={styles.areaTitle}>{a.title}</h2>
            {a.body()}
          </section>
        ))}
      </div>
    </section>
  );
}
