import { effect, signal } from '@preact/signals';
import { DEFAULT_LOOK, buildTheme } from '../lib/theme.ts';
import type { Contrast, Mode } from '../lib/theme.ts';

export type Theme = 'system' | 'light' | 'dark';
export interface Settings { api: string; token: string; theme: Theme; accent: string; tint: string; contrast: Contrast }

/* Per-device convenience only; the shift data itself lives in IndexedDB.
 * The key is unchanged from the single-file app so existing connections carry over. */
const KEY = 'conf';
const DEFAULTS: Settings = { api: '', token: '', theme: 'system', ...DEFAULT_LOOK };
const read = (): Settings => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
};

export const settings = signal<Settings>(read());
export const connected = () => !!(settings.value.api && settings.value.token);

export function saveSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings.value)); } catch { /* private mode: keep in memory */ }
}

/** Which of light/dark is showing right now, whatever the setting (System follows the device). */
const dark = window.matchMedia('(prefers-color-scheme: dark)');
export const systemDark = signal(dark.matches);
dark.addEventListener('change', e => { systemDark.value = e.matches; });
export const mode = (): Mode => (settings.value.theme === 'system' ? (systemDark.value ? 'dark' : 'light') : settings.value.theme);
/** The rail's one-tap switch: to the other of light and dark. */
export const flipTheme = () => saveSettings({ theme: mode() === 'dark' ? 'light' : 'dark' });

/** Applies the palette to <html>: the mode as data-theme (which picks the static status colours) and the ramp, accent and
 *  contrast as inline custom properties, which win over tokens.css. */
const applied: string[] = [];
effect(() => {
  const s = settings.value, m: Mode = s.theme === 'system' ? (systemDark.value ? 'dark' : 'light') : s.theme;
  const root = document.documentElement, vars = buildTheme({ mode: m, accent: s.accent, tint: s.tint, contrast: s.contrast });
  root.setAttribute('data-theme', m);
  for (const k of applied) if (!(k in vars)) root.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) { root.style.setProperty(k, v); if (!applied.includes(k)) applied.push(k); }
  document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.setAttribute('content', vars['--bg']!));
});
