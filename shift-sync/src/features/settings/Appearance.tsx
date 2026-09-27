import { flipTheme, mode, saveSettings, settings } from '../../data/settings.ts';
import type { Theme } from '../../data/settings.ts';
import { ACCENTS, DEFAULT_LOOK, TINTS, resolveAccent } from '../../lib/theme.ts';
import type { Contrast } from '../../lib/theme.ts';
import styles from './SettingsScreen.module.css';

const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];
const CONTRASTS: { id: Contrast; label: string; note: string }[] = [
  { id: 'soft', label: 'Soft', note: 'Gentler text and lines.' },
  { id: 'standard', label: 'Standard', note: 'Balanced. Every text step is at least 4.5:1 on every surface.' },
  { id: 'high', label: 'High', note: 'Darker text, firmer lines. Best for bright rooms.' }
];
const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/* How the site looks: light or dark, the primary colour, the background tint, and how firm the text and lines are. The
 * palette is a ramp solved from these choices (lib/theme.ts), so a text colour is never faint whatever you pick. */
export function Appearance() {
  const s = settings.value, m = mode(), custom = isHex(s.accent);
  return (
    <div class={styles.stack}>
      <section class={styles.sec} aria-labelledby="ap-mode">
        <h2 id="ap-mode" class="label">Light or dark</h2>
        <div class="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map(t => (
            <label key={t.id}><input type="radio" name="theme" checked={s.theme === t.id} onChange={() => saveSettings({ theme: t.id })} /><span>{t.label}</span></label>
          ))}
        </div>
        <p class={styles.p}>System follows your device. The switch in the left rail flips between light and dark from any page.</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-acc">
        <h2 id="ap-acc" class="label">Primary colour</h2>
        <div class={styles.swatches} role="radiogroup" aria-label="Primary colour">
          {ACCENTS.map(a => (
            <label key={a.id} class={styles.swatch} title={a.label}>
              <input type="radio" name="accent" checked={s.accent === a.id} onChange={() => saveSettings({ accent: a.id })} />
              <i style={{ background: a[m] }} /><span>{a.label}</span>
            </label>
          ))}
          <label class={styles.swatch} title="Pick any colour">
            <input type="color" value={custom ? s.accent : resolveAccent(s.accent, 'light')} onInput={e => saveSettings({ accent: e.currentTarget.value })} aria-label="Custom primary colour" />
            <i class={styles.custom} style={custom ? { background: resolveAccent(s.accent, m) } : undefined} /><span>Custom</span>
          </label>
        </div>
        <p class={styles.p}>Used for buttons, the selected page, charts and the shading in the calendar. If a colour would be too faint to read as text, it is deepened (light) or lightened (dark) automatically.</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-tint">
        <h2 id="ap-tint" class="label">Background</h2>
        <div class={styles.swatches} role="radiogroup" aria-label="Background tint">
          {TINTS.map(t => (
            <label key={t.id} class={styles.swatch} title={t.label}>
              <input type="radio" name="tint" checked={s.tint === t.id} onChange={() => saveSettings({ tint: t.id })} />
              <i class={styles.twin} style={{ background: `linear-gradient(135deg, hsl(${t.h} ${t.s}% ${m === 'dark' ? 8.5 : 92.5}%) 50%, hsl(${t.h} ${t.s}% ${m === 'dark' ? 13 : 98.5}%) 50%)` }} /><span>{t.label}</span>
            </label>
          ))}
        </div>
        <p class={styles.p}>The grey page shows around the navigation and the title. Cards sit on it, a step lighter, so the content is what stands out.</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-con">
        <h2 id="ap-con" class="label">Contrast</h2>
        <div class="seg" role="radiogroup" aria-label="Contrast">
          {CONTRASTS.map(c => (
            <label key={c.id}><input type="radio" name="contrast" checked={s.contrast === c.id} onChange={() => saveSettings({ contrast: c.id })} /><span>{c.label}</span></label>
          ))}
        </div>
        <p class={styles.p}>{CONTRASTS.find(c => c.id === s.contrast)!.note}</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-prev">
        <h2 id="ap-prev" class="label">Preview</h2>
        <div class={styles.preview}>
          <div class={styles.pvHead}><b>Shift</b><span>Earned</span></div>
          <div class={styles.pvRow}><span><b>Jul 30</b><span class={styles.pvFaint}>Wed · 6:00p–2:10a</span></span><span><b>$448</b><span>Tips $380</span></span></div>
          <div class={`${styles.pvRow} ${styles.pvBand}`}><b>Week of Jul 26</b><b>$997</b></div>
          <div class={styles.pvRow}><span><b>Jul 29</b><span class={styles.pvFaint}>Tue · 5:00p–2:30a</span></span><span><b>$428</b><span>Tips $360</span></span></div>
          <div class={styles.pvActions}><button type="button" class="btn btn-primary">Primary</button><button type="button" class="btn" onClick={flipTheme}>Flip light / dark</button></div>
        </div>
      </section>

      <div><button type="button" class="btn btn-quiet" onClick={() => saveSettings({ ...DEFAULT_LOOK })}>Reset colours</button></div>
    </div>
  );
}
