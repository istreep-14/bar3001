import type { Screen } from '../../router.ts';
import { PanelHead } from '../../ui/PanelHead.tsx';
import { Appearance } from './Appearance.tsx';
import { SheetSync } from './SheetSync.tsx';
import { WageRates } from './WageRates.tsx';
import { YourData } from './YourData.tsx';
import styles from './SettingsScreen.module.css';

/* Settings is a group of pages, each one setting area, reached from the second rail: Appearance, Wages, Google Sheet, Your data. */
const TITLES: Record<string, string> = { 'settings/look': 'Appearance', 'settings/wages': 'Hourly wage', 'settings/sync': 'Google Sheet', 'settings/data': 'Your data' };

export function SettingsScreen({ page }: { page: Screen }) {
  return (
    <section class="panel" aria-labelledby="settings-title">
      <PanelHead title={TITLES[page] ?? 'Settings'} id="settings-title" />
      <div class={`panel-body ${styles.screen}`}>
        {page === 'settings/look' && <Appearance />}
        {page === 'settings/wages' && <WageRates />}
        {page === 'settings/sync' && <SheetSync />}
        {page === 'settings/data' && <YourData />}
      </div>
    </section>
  );
}
