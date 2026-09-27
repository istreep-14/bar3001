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

/* ── Bands: nested, collapsible groups of rows (year > month > week) ──────────────────────────
 * Rows must arrive sorted by the thing being banded, so each band is contiguous. */
export interface Band<T> { id: string; key: (r: T) => string; label: (r: T) => string }
export type Entry<T> =
  | { kind: 'row'; row: T }
  | { kind: 'band'; level: number; path: string; label: string; rows: T[]; collapsed: boolean };

const pathsOf = <T>(r: T, bands: Band<T>[]): string[] => {
  const out: string[] = []; let p = '';
  for (const b of bands) { p += `${p ? '/' : ''}${b.id}:${b.key(r)}`; out.push(p); }
  return out;
};

/** Every band path present in the rows: what "collapse all" collapses. */
export function bandPaths<T>(rows: T[], bands: Band<T>[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) pathsOf(r, bands).forEach(p => seen.add(p));
  return [...seen];
}

/** Interleaves band headers with rows. Rows (and deeper headers) inside a collapsed band are left out. */
export function buildEntries<T>(rows: T[], bands: Band<T>[], collapsed: ReadonlySet<string>): Entry<T>[] {
  if (!bands.length) return rows.map(row => ({ kind: 'row', row }));
  const members = new Map<string, T[]>();
  for (const r of rows) for (const p of pathsOf(r, bands)) members.set(p, [...(members.get(p) ?? []), r]);
  const out: Entry<T>[] = [];
  let prev: string[] = [];
  for (const r of rows) {
    const paths = pathsOf(r, bands);
    const firstNew = paths.findIndex((p, i) => p !== prev[i]);
    for (let l = firstNew < 0 ? bands.length : firstNew; l < bands.length; l++) {
      if (l > 0 && collapsed.has(paths[l - 1]!)) break;          // hidden inside a collapsed ancestor
      const path = paths[l]!;
      out.push({ kind: 'band', level: l, path, label: bands[l]!.label(r), rows: members.get(path)!, collapsed: collapsed.has(path) });
    }
    if (!paths.some(p => collapsed.has(p))) out.push({ kind: 'row', row: r });
    prev = paths;
  }
  return out;
}

export interface EntryPage<T> { entries: Entry<T>[]; page: number; pages: number; from: number; to: number; total: number }

/** Pages by rows only. A header travels with the first row after it (or the last page, when everything under it is collapsed). */
export function paginateEntries<T>(entries: Entry<T>[], size: number, page: number): EntryPage<T> {
  const total = entries.filter(e => e.kind === 'row').length;
  if (!size) return { entries, page: 0, pages: 1, from: total ? 1 : 0, to: total, total };
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  const pageOf: number[] = [];
  let n = 0, pending: number[] = [];
  entries.forEach((e, i) => {
    if (e.kind === 'band') { pending.push(i); return; }
    const pg = Math.floor(n++ / size);
    pending.forEach(j => { pageOf[j] = pg; }); pending = [];
    pageOf[i] = pg;
  });
  pending.forEach(j => { pageOf[j] = pages - 1; });
  const shown = entries.filter((_, i) => pageOf[i] === p);
  const start = p * size;
  return { entries: shown, page: p, pages, from: total ? start + 1 : 0, to: Math.min(total, start + size), total };
}
