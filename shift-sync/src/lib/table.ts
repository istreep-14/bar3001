export type SortValue = number | string | null | undefined;
export type Dir = 'asc' | 'desc';

export const PAGE_SIZES = [10, 25, 50, 100, 0] as const;   // 0 = all
export interface Page<T> { rows: T[]; page: number; pages: number; from: number; to: number; total: number }

/** Zero-based page of `size` rows (0 = everything). An out-of-range page is clamped. */
export function paginate<T>(rows: T[], size: number, page: number): Page<T> {
  const total = rows.length;
  if (!size) return { rows, page: 0, pages: 1, from: total ? 1 : 0, to: total, total };
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  const start = p * size;
  return { rows: rows.slice(start, start + size), page: p, pages, from: total ? start + 1 : 0, to: Math.min(total, start + size), total };
}

/** One level of a sort: a value to compare and which way. */
export interface SortKey<T> { get: (r: T) => SortValue; dir: Dir }

/** Sort by several keys: the first decides, the next breaks its ties, and so on; rows still tied keep the order they came in.
 *  Blanks go last within each key, whichever direction. So sorting by Role after sorting by Name keeps names A to Z within a role. */
export function sortBy<T>(rows: T[], keys: SortKey<T>[]): T[] {
  if (!keys.length) return rows;
  const vals = rows.map((r, i) => ({ r, i, v: keys.map(k => k.get(r)) }));
  vals.sort((a, b) => {
    for (let k = 0; k < keys.length; k++) {
      const x = a.v[k], y = b.v[k], xn = x == null || x === '', yn = y == null || y === '';
      if (xn || yn) { if (xn !== yn) return xn ? 1 : -1; continue; }
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      if (c) return keys[k]!.dir === 'asc' ? c : -c;
    }
    return a.i - b.i;
  });
  return vals.map(x => x.r);
}

/** The sort after clicking a column: the column already on top flips direction; any other goes on top in `dir`, and the
 *  sorts before it stay underneath as tie-breakers (the last few). */
export function pushSort(stack: { key: string; dir: Dir }[], key: string, dir: Dir, keep = 3): { key: string; dir: Dir }[] {
  if (stack[0]?.key === key) return [{ key, dir: stack[0].dir === 'asc' ? 'desc' : 'asc' }, ...stack.slice(1)];
  return [{ key, dir }, ...stack.filter(s => s.key !== key)].slice(0, keep);
}

/** Drag the edge between column i and the next by `by` weight units: one grows as the other shrinks, so the total stays put.
 *  Neither goes below `min`. */
export function resizeWeights(w: number[], i: number, by: number, min = 0.4): number[] {
  const a = w[i], b = w[i + 1];
  if (a == null || b == null) return w;
  const d = Math.max(min - a, Math.min(b - min, by));
  const out = [...w];
  out[i] = a + d; out[i + 1] = b - d;
  return out;
}
