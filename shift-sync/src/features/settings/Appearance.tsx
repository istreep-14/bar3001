import { flipTheme, mode, saveSettings, settings } from '../../data/settings.ts';
import type { Theme } from '../../data/settings.ts';
import { ACCENTS, DEFAULT_LOOK, TINTS, buildTheme, isHex, resolveAccent } from '../../lib/theme.ts';
import type { Contrast, Mode } from '../../lib/theme.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import styles from './SettingsScreen.module.css';

const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];
const CONTRASTS: { id: Contrast; label: string; note: string }[] = [
  { id: 'soft', label: 'Soft', note: 'Gentler text and lines.' },
  { id: 'standard', label: 'Standard', note: 'Balanced. Every text step is at least 4.5:1 on every surface.' },
  { id: 'high', label: 'High', note: 'Darker text, firmer lines. Best for bright rooms.' }
];
const MODES: { mode: Mode; label: string }[] = [{ mode: 'light', label: 'Light' }, { mode: 'dark', label: 'Dark' }];
type ExactKey = 'bgLight' | 'bgDark' | 'avatarBgLight' | 'avatarBgDark';
const keyFor = (what: 'bg' | 'avatarBg', md: Mode) => `${what}${md === 'dark' ? 'Dark' : 'Light'}` as ExactKey;
const SAMPLE = [{ id: 'sample-a', name: 'Alex Kim' }, { id: 'sample-b', name: 'Jordan Reyes' }, { id: 'sample-c', name: 'Sam Ortiz' }];

/** One exact colour for one mode: a swatch that opens the picker at `fallback` until something is picked (and shows it, or
 *  with `perPerson` the rainbow for "each person's own"), and the picked hex as a button that clears it. */
function ExactPick({ k, label, what, fallback, perPerson }: { k: ExactKey; label: string; what: string; fallback: string; perPerson?: boolean }) {
  const v = settings.value[k], on = isHex(v);
  return (
    <span class={styles.exactItem}>
      <label class={styles.swatch} data-on={on ? '' : undefined} title={`Pick the ${what} for ${label.toLowerCase()} mode`}>
        <input type="color" value={on ? v : fallback} onInput={e => saveSettings({ [k]: e.currentTarget.value })} aria-label={`${label} mode ${what}`} />
        <i class={!on && perPerson ? `${styles.twin} ${styles.unset}` : styles.twin} style={on || !perPerson ? { background: on ? v : fallback } : undefined} /><span>{label}</span>
      </label>
      {on && <button type="button" class="btn btn-quiet" onClick={() => saveSettings({ [k]: '' })} aria-label={`Clear the ${label.toLowerCase()} mode ${what}`}>{v.toUpperCase()} ×</button>}
    </span>
  );
}

/* How the site looks: light or dark, the primary colour, the background tint, and how firm the text and lines are. The
 * palette is a ramp solved from these choices (lib/theme.ts), so a text colour is never faint whatever you pick. */
export function Appearance() {
  const s = settings.value, m = mode(), custom = isHex(s.accent);
  const pageKey = m === 'dark' ? 'bgDark' : 'bgLight', exactNow = isHex(s[pageKey]);
  /** The palette a mode shows with no exact colours, where each picker starts. */
  const stock = (md: Mode) => buildTheme({ mode: md, accent: s.accent, tint: s.tint, contrast: s.contrast });
  return (
    <div class={styles.stack}>
      <section class={styles.sec} aria-labelledby="ap-mode">
        <h3 id="ap-mode" class="label">Light or dark</h3>
        <div class="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map(t => (
            <label key={t.id}><input type="radio" name="theme" checked={s.theme === t.id} onChange={() => saveSettings({ theme: t.id })} /><span>{t.label}</span></label>
          ))}
        </div>
        <p class={styles.p}>System follows your device. The switch in the left rail flips between light and dark from any page.</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-acc">
        <h3 id="ap-acc" class="label">Primary colour</h3>
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
        <h3 id="ap-tint" class="label">Background</h3>
        <div class={styles.swatches} role="radiogroup" aria-label="Background tint">
          {TINTS.map(t => (
            <label key={t.id} class={styles.swatch} title={t.label}>
              <input type="radio" name="tint" checked={!exactNow && s.tint === t.id} onChange={() => saveSettings({ tint: t.id, [pageKey]: '' })} />
              <i class={styles.twin} style={{ background: `linear-gradient(135deg, hsl(${t.h} ${t.s}% ${m === 'dark' ? 8.5 : 92.5}%) 50%, hsl(${t.h} ${t.s}% ${m === 'dark' ? 13 : 98.5}%) 50%)` }} /><span>{t.label}</span>
            </label>
          ))}
        </div>
        <div class={styles.exact} role="group" aria-label="Exact page colour">
          <span class={styles.exactLabel}>Exact colour</span>
          {MODES.map(md => <ExactPick key={md.mode} k={keyFor('bg', md.mode)} label={md.label} what="page colour" fallback={stock(md.mode)['--bg']!} />)}
        </div>
        <p class={styles.p}>The grey page shows around the navigation and the title. Cards sit on it, a step lighter, so the content is what stands out. An exact colour is used as it is for that mode, on every page; the cards and text follow it.</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-av">
        <h3 id="ap-av" class="label">Avatars</h3>
        <div class={styles.exact} role="group" aria-label="Avatar fill">
          <span class={styles.exactLabel}>Fill</span>
          {MODES.map(md => <ExactPick key={md.mode} k={keyFor('avatarBg', md.mode)} label={md.label} what="avatar fill" fallback={stock(md.mode)['--surface-3']!} perPerson />)}
        </div>
        <div class={styles.avPreview} aria-label="Avatar preview">
          {SAMPLE.map(p => <Avatar key={p.id} id={p.id} name={p.name} size="md" />)}
          <span class="avatars">{SAMPLE.map(p => <Avatar key={p.id} id={p.id} name={p.name} />)}</span>
        </div>
        <p class={styles.p}>Every avatar without a colour of its own takes this fill (letters turn black or white to suit it). A colour picked on a person still wins. Unset, each person gets a colour from their name.</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-con">
        <h3 id="ap-con" class="label">Contrast</h3>
        <div class="seg" role="radiogroup" aria-label="Contrast">
          {CONTRASTS.map(c => (
            <label key={c.id}><input type="radio" name="contrast" checked={s.contrast === c.id} onChange={() => saveSettings({ contrast: c.id })} /><span>{c.label}</span></label>
          ))}
        </div>
        <p class={styles.p}>{CONTRASTS.find(c => c.id === s.contrast)!.note}</p>
      </section>

      <section class={styles.sec} aria-labelledby="ap-prev">
        <h3 id="ap-prev" class="label">Preview</h3>
        <div class={styles.preview}>
          <div class={styles.pvHead}><b>Shift</b><span>Total</span></div>
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
