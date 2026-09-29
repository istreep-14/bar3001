/* People helpers: finding a person from part of a name (their roster name, first and last name, or any alias), and
 * the letters their avatar shows. Pure, so a crew picker, a search box or a test can all use the same rules. */

export interface Findable { id: string; name: string; first: string | null; last: string | null; aliases: string[] }
/** `via` is the alias that matched when it was an alias (so a picker can say "Abby, as Abs"), else null. */
export interface Match<P> { person: P; score: number; via: string | null }

/** Lower case, accents off, spaces collapsed: "  José " and "jose" are the same name. */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** How well one name answers what was typed: 4 exact, 3 the start, 2 the start of a later word, 1 anywhere in it, 0 not at all. */
function rate(name: string, q: string): number {
  const n = fold(name);
  if (!n) return 0;
  if (n === q) return 4;
  if (n.startsWith(q)) return 3;
  if (n.split(' ').some(w => w.startsWith(q))) return 2;
  return n.includes(q) ? 1 : 0;
}

/** Everyone whose name, first or last name, full name or an alias matches `query`, best first (then by name). A name
 *  beats an alias at the same strength, so typing "Sam" puts Sam above the person nicknamed Sam. Blank matches everyone. */
export function findPeople<P extends Findable>(people: P[], query: string): Match<P>[] {
  const q = fold(query);
  const byName = (a: Match<P>, b: Match<P>) => b.score - a.score || a.person.name.localeCompare(b.person.name);
  if (!q) return people.map(person => ({ person, score: 0, via: null })).sort(byName);
  const out: Match<P>[] = [];
  for (const person of people) {
    const own = Math.max(...[person.name, person.first ?? '', person.last ?? '', [person.first, person.last].filter(Boolean).join(' ')].map(n => rate(n, q)));
    let best: Match<P> | null = own ? { person, score: own + 0.5, via: null } : null;
    for (const a of person.aliases) {
      const r = rate(a, q);
      if (r && (!best || r > best.score)) best = { person, score: r, via: a };
    }
    if (best) out.push(best);
  }
  return out.sort(byName);
}

/** The letters an avatar shows: the person's own choice, else the first letter of the first two words of the name. */
export const initials = (name: string, own?: string | null): string =>
  own?.trim() || name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

/** A stable number from an id, so a person with no colour chosen always lands on the same one. */
export const hashOf = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** A person's main role and the rest. Rows from before the main role existed have none set: their first role is the main one. */
export function rolesOf(p: { role: string | null; roles: string[] }): { main: string | null; others: string[] } {
  if (p.role) return { main: p.role, others: p.roles.filter(r => r.toLowerCase() !== p.role!.toLowerCase()) };
  return { main: p.roles[0] ?? null, others: p.roles.slice(1) };
}

/** The short name as a handle, "@Abby". Spaces read as underscores so it stays one word: "Big Mike" is @Big_Mike. */
export const handle = (name: string): string => '@' + name.trim().replace(/\s+/g, '_');
