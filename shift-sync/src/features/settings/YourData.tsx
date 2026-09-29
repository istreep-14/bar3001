import { importBundle, liveViews } from '../../data/store.ts';
import type { Bundle } from '../../lib/bundle.ts';
import { toHHMM } from '../../core/core.generated.js';
import { Icon } from '../../ui/Icon.tsx';
import { toast } from '../../ui/toast.tsx';
import styles from './SettingsScreen.module.css';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function exportCsv() {
  const head = ['date', 'start', 'end', 'shift_type', 'hours', 'tips', 'other_income', 'total', 'notes'];
  const rows = liveViews.value.map(v => [v.shift.date, toHHMM(v.shift.start), toHHMM(v.shift.end), v.shift.shift_type, v.hours ?? '', v.shift.tips ?? '', v.extra, v.total, v.shift.notes]);
  const blob = new Blob([[head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'shifts.csv'; a.click();
  URL.revokeObjectURL(a.href);
}

/** One or more bundle files, in the order chosen (an earlier file wins where a later one repeats a shift). */
async function importFiles(e: Event) {
  const input = e.currentTarget as HTMLInputElement, files = [...(input.files ?? [])];
  input.value = '';
  let shifts = 0, income = 0, crew = 0, people = 0, wages = 0;
  try {
    for (const file of files) {
      const b = JSON.parse(await file.text()) as Bundle;
      if (!Array.isArray(b.rows) || !Array.isArray(b.staff) || !Array.isArray(b.crew) || !Array.isArray(b.income)) throw new Error(`${file.name} is not an import file`);
      const p = await importBundle(b);
      shifts += p.rows.length; income += p.income.length; crew += p.crew.length; people += p.staff.length; wages += p.wages.length;
      if (p.problems.length) console.warn('Import problems', file.name, p.problems);
    }
    if (files.length) toast(shifts + income + crew + people + wages === 0 ? 'Nothing new to import (already here)'
      : `Imported ${shifts} shifts, ${income} income lines, ${crew} crew, ${people} people${wages ? `, ${wages} wages` : ''}`);
  } catch (err) {
    toast(`Could not import: ${err instanceof Error ? err.message : 'bad file'}`);
  }
}

export function YourData() {
  return (
    <div class={styles.stack}>
      <section class={styles.sec} aria-labelledby="data">
        <h3 id="data" class="label">Export and import</h3>
        <p class={styles.p}>{liveViews.value.length} shifts on this device.</p>
        <div class={styles.actions}>
          <button class="btn" type="button" onClick={exportCsv} disabled={!liveViews.value.length}><Icon name="download" /> Export CSV</button>
          <label class="btn" style={{ cursor: 'pointer' }}>
            <Icon name="plus" /> Import shifts (JSON)
            <input type="file" accept="application/json,.json" multiple onChange={importFiles} hidden />
          </label>
        </div>
        <p class={styles.p}>Adds only what isn't here yet; nothing you already have is changed.</p>
      </section>
    </div>
  );
}
