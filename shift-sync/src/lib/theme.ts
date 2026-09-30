/* The palette engine. The site's colours are not two extremes (paper white and near-black) but a ramp: the page is a
 * grey canvas, panels sit lighter on it, and ink is four steps, all derived from a few choices (mode, accent, background
 * tint, contrast) and solved so every text step keeps a WCAG contrast ratio against every surface it can sit on.
 * Pure functions; settings.ts applies the result to <html> as CSS custom properties, which win over tokens.css. */

export type Mode = 'light' | 'dark';
export type Contrast = 'soft' | 'standard' | 'high';
export interface Accent { id: string; label: string; light: string; dark: string }
export interface Tint { id: string; label: string; h: number; s: number }

export const ACCENTS: Accent[] = [
  { id: 'teal', label: 'Teal', light: '#0d7a70', dark: '#4fd6c4' },
  { id: 'blue', label: 'Blue', light: '#1d5fc9', dark: '#7aa8ff' },
  { id: 'indigo', label: 'Indigo', light: '#4f46e5', dark: '#9a95ff' },
  { id: 'green', label: 'Green', light: '#1a7f37', dark: '#5fd67f' },
  { id: 'amber', label: 'Amber', light: '#a35a00', dark: '#f2b04a' },
  { id: 'rose', label: 'Rose', light: '#be1e5a', dark: '#f58bb3' },
  { id: 'slate', label: 'Slate', light: '#475569', dark: '#a9b8cc' }
];
export const TINTS: Tint[] = [
  { id: 'grey', label: 'Soft grey', h: 232, s: 12 },
  { id: 'teal', label: 'Mint', h: 172, s: 14 },
  { id: 'slate', label: 'Slate', h: 215, s: 14 },
  { id: 'warm', label: 'Stone', h: 38, s: 13 },
  { id: 'neutral', label: 'Neutral', h: 0, s: 0 }
];

/* ── colour maths ── */
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', ''), v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map(x => x / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(x => { const c = x / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** `t` of the way from a to b (0..1). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
/** The colour of hue/saturation whose lightness first reaches `target` contrast against `against`, moving toward black (dir -1) or white (+1) from `from`. */
function solve(against: string[], h: number, s: number, from: number, dir: 1 | -1, target: number): string {
  let l = from, out = hslToHex(h, s, l);
  for (let i = 0; i < 100 && against.some(bg => contrast(out, bg) < target); i++) { l = clamp(l + dir * 1, 0, 100); out = hslToHex(h, s, l); }
  return out;
}

/** `bg` is an exact page colour ('#rrggbb') for this mode; blank means the tint's own grey. `avatarBg` fills every avatar that
 *  has no colour of its own; blank keeps the colour picked from each person's id. */
export interface ThemeOpts { mode: Mode; accent: string; tint: string; contrast: Contrast; bg?: string; avatarBg?: string }
export const DEFAULT_LOOK = {
  accent: 'teal', tint: 'grey', contrast: 'standard' as Contrast,
  bgLight: '', bgDark: '', avatarBgLight: '', avatarBgDark: ''
};
export const isHex = (v: string | null | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v);

/** `accent` is a preset id or a #hex; a custom colour is used as-is in light and lightened for dark. */
export function resolveAccent(id: string, mode: Mode): string {
  const p = ACCENTS.find(a => a.id === id);
  if (p) return p[mode];
  if (!isHex(id)) return ACCENTS[0]![mode];
  if (mode === 'light') return id;
  const { h, s, l } = hexToHsl(id);
  return hslToHex(h, s, Math.max(l, 68));
}

/** Black or white, whichever reads better on `hex`. */
export const onColor = (hex: string) => (contrast(hex, '#ffffff') >= contrast(hex, '#111111') ? '#ffffff' : '#111111');

/** Every colour the page's neutral scale and primary colour need. Text steps are solved against the surfaces they sit on. */
export function buildTheme(o: ThemeOpts): Record<string, string> {
  const t = TINTS.find(x => x.id === o.tint) ?? TINTS[0]!, dark = o.mode === 'dark';
  // An exact page colour takes the tint's place: its hue and saturation colour the ramp, and every step keeps its usual
  // distance from the page's own lightness, so the page itself is exactly the colour picked.
  const exact = isHex(o.bg) ? o.bg : null, picked = exact ? hexToHsl(exact) : null;
  const { h, s } = picked ?? t, base = picked?.l ?? (dark ? 6.5 : 91);
  const step = (light: number, dk: number) => clamp(base + (dark ? dk - 6.5 : light - 91), 0, 100);   // the stock lightness, moved with the page
  const k = { soft: 0, standard: 1, high: 2 }[o.contrast];
  const ts = Math.min(s, 24);   // text never takes on more colour than a soft tint, whatever the page
  // The page is a light grey canvas. Panels sit a step or two above it, close enough that the grey still reads
  // as one field; only content you act on (the table, a field, an opened row) reaches the near-white top step.
  const bg = exact ?? hslToHex(h, s, base), surface = hslToHex(h, s, step(99.5, 13.5)), surface2 = hslToHex(h, s, step(96, 10));
  const surface3 = hslToHex(h, s + 2, step(86, 18));
  const lines = dark ? [step(0, 24 + k * 2), step(0, 30 + k * 3), step(0, 40 + k * 5)] : [step(92 - k * 2, 0), step(88 - k * 3, 0), step(78 - k * 5, 0)];
  const grounds = [bg, surface, surface2, surface3];
  const ink = solve(grounds, h, Math.min(ts + 6, 24), dark ? 94 : 12, dark ? 1 : -1, [12, 14, 16][k]!);
  const ink2 = solve(grounds, h, ts, dark ? 78 : 30, dark ? 1 : -1, [5.4, 6.6, 8.2][k]!);
  const ink3 = solve(grounds, h, ts, dark ? 66 : 42, dark ? 1 : -1, [4.6, 5.2, 6.2][k]!);
  const ink4 = solve(grounds, h, ts, dark ? 48 : 62, dark ? 1 : -1, 2.4);
  // primary: as chosen, but never too faint to read as text on the panel
  let accent = resolveAccent(o.accent, o.mode);
  if (contrast(accent, surface) < 4.5) { const a = hexToHsl(accent); accent = solve([surface, bg], a.h, a.s, a.l, dark ? 1 : -1, 4.5); }
  const a = hexToHsl(accent);
  const onAccent = contrast('#ffffff', accent) >= 4.5 ? '#ffffff' : '#0a1210';
  // the site-wide avatar fill, only when set (ui.css falls back to each person's own); letters black or white on the fill
  const avatar: Record<string, string> = {};
  if (isHex(o.avatarBg)) { avatar['--avatar-bg'] = o.avatarBg; avatar['--avatar-ink'] = onColor(o.avatarBg); }
  return {
    ...avatar,
    '--bg': bg, '--surface': surface, '--surface-2': surface2, '--surface-3': surface3,
    '--line': hslToHex(h, s, lines[1]!), '--line-soft': hslToHex(h, s, lines[0]!), '--line-strong': hslToHex(h, s, lines[2]!),
    '--ink': ink, '--ink-2': ink2, '--ink-3': ink3, '--ink-4': ink4,
    '--accent': accent, '--accent-hover': hslToHex(a.h, a.s, clamp(a.l + (dark ? 8 : -7), 0, 100)),
    '--accent-soft': mix(surface, accent, dark ? 0.2 : 0.13), '--accent-wash': mix(surface, accent, dark ? 0.09 : 0.06),
    '--on-accent': onAccent,
    '--rail-bg': 'transparent', '--rail-ink': ink2, '--rail-ink-hi': ink
  };
}
