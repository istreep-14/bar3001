/** A small initials circle for a crew member, coloured from the app's own palette (no per-person setting to read). */
const PALETTE = ['--accent', '--cat-chump', '--cat-venmo', '--cat-consideration', '--cat-overtime', '--cat-wage', '--party', '--night'];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ id, name }: { id: string; name: string }) {
  const c = `var(${PALETTE[hash(id) % PALETTE.length]})`;
  return <span class="avatar" style={{ '--ac': c }} title={name}>{initials(name)}</span>;
}
