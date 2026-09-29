/* The colours a person's avatar or a role can take, by the name stored on them. Each is a token, so it follows the theme;
 * a '#rrggbb' someone picked is used as it is. */
export const SWATCHES: { id: string; label: string; token: string }[] = [
  { id: 'teal', label: 'Primary', token: '--accent' },
  { id: 'orange', label: 'Orange', token: '--cat-chump' },
  { id: 'green', label: 'Green', token: '--cat-cash' },
  { id: 'cyan', label: 'Cyan', token: '--cat-venmo' },
  { id: 'violet', label: 'Violet', token: '--cat-consideration' },
  { id: 'pink', label: 'Pink', token: '--cat-overtime' },
  { id: 'blue', label: 'Blue', token: '--cat-wage' },
  { id: 'rose', label: 'Rose', token: '--party' },
  { id: 'indigo', label: 'Indigo', token: '--night' },
  { id: 'gold', label: 'Gold', token: '--me' }
];

/** A stored colour as CSS: a named swatch's token, a hex as it is, or null when it is neither (blank or unknown). */
export function swatchColor(color: string | null | undefined): { value: string; custom: boolean } | null {
  if (!color) return null;
  if (color.startsWith('#')) return { value: color, custom: true };
  const named = SWATCHES.find(c => c.id === color);
  return named ? { value: `var(${named.token})`, custom: false } : null;
}
