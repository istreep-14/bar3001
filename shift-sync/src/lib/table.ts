export type SortValue = number | string | null | undefined;
export type Dir = 'asc' | 'desc';

/** Sort by an accessor. Blanks always go last, whichever direction; ties keep their original order. */
export function sortRows<T>(rows: T[], get: (r: T) => SortValue, dir: Dir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: get(r) }))
    .sort((a, b) => {
      const an = a.v == null || a.v === '', bn = b.v == null || b.v === '';
      if (an || bn) return an === bn ? a.i - b.i : an ? 1 : -1;
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v));
      return c ? c * sign : a.i - b.i;
    })
    .map(x => x.r);
}

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
