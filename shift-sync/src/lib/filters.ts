/* Filtering a list by the values of its fields (a person's role, status...). A field is a function that gives a row's value
 * or values; a filter is the values picked for each field. A row passes when, for every field with something picked, one of its
 * values is picked. A row with no value for a field has NONE, so "no role" can be picked too. Pure, so any page can use it. */
export const NONE = '';
export type Field<T> = (row: T) => string | string[] | null | undefined;
export type Filters = Record<string, string[]>;

const valuesOf = <T>(f: Field<T>, r: T): string[] => { const v = f(r); const a = v == null ? [] : Array.isArray(v) ? v : [v]; return a.length ? a : [NONE]; };

export function applyFilters<T>(rows: T[], filters: Filters, fields: Record<string, Field<T>>): T[] {
  const on = Object.entries(filters).filter(([k, v]) => v.length && fields[k]);
  if (!on.length) return rows;
  return rows.filter(r => on.every(([k, picked]) => valuesOf(fields[k]!, r).some(v => picked.includes(v))));
}

/** Each value a field takes across the rows, with how many rows have it, most common first (then A to Z, NONE last). */
export function facet<T>(rows: T[], field: Field<T>): { value: string; count: number }[] {
  const n = new Map<string, number>();
  for (const r of rows) for (const v of new Set(valuesOf(field, r))) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].map(([value, count]) => ({ value, count }))
    .sort((a, b) => Number(a.value === NONE) - Number(b.value === NONE) || b.count - a.count || a.value.localeCompare(b.value));
}

/** Picks or unpicks one value of one field. */
export function toggleFilter(f: Filters, key: string, value: string): Filters {
  const cur = f[key] ?? [];
  const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
  const out = { ...f, [key]: next };
  if (!next.length) delete out[key];
  return out;
}
