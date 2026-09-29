import { signal } from '@preact/signals';
import type { Signal } from '@preact/signals';

/* A view choice the device remembers (a grouping, a view, a page size): a signal backed by localStorage, validated on
 * the way in so a stale or hand-edited value falls back instead of breaking the page. Storage can be missing or refuse
 * writes (private mode), so both directions are best-effort. Values are written as JSON; a plain string saved by an
 * older build still reads back. */
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browser = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function persisted<T>(key: string, ok: (v: unknown) => v is T, fallback: T, store: Store | null = browser()): [Signal<T>, (v: T) => void] {
  const read = (): T => {
    try {
      const raw = store?.getItem(key);
      if (raw == null) return fallback;
      let v: unknown;
      try { v = JSON.parse(raw); } catch { v = raw; }
      return ok(v) ? v : fallback;
    } catch { return fallback; }
  };
  const s = signal<T>(read());
  const set = (v: T) => { s.value = v; try { store?.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
  return [s, set];
}

/** A validator for one of a fixed set of values. */
export const oneOf = <T extends string | number>(values: readonly T[]) => (v: unknown): v is T => values.includes(v as T);

/** A bag of settings: missing storage, bad JSON or a non-object falls back to `defaults`, and a saved object is merged
 *  over them so a field added later still has a value. `set` patches the bag and writes the whole thing back. */
export function persistedObject<T extends object>(key: string, defaults: T, store: Store | null = browser()): [Signal<T>, (patch: Partial<T>) => void] {
  const read = (): T => {
    try {
      const raw = store?.getItem(key);
      if (raw == null) return { ...defaults };
      const v: unknown = JSON.parse(raw);
      if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...defaults };
      return { ...defaults, ...(v as Partial<T>) };
    } catch { return { ...defaults }; }
  };
  const s = signal<T>(read());
  const set = (patch: Partial<T>) => {
    s.value = { ...s.value, ...patch };
    try { store?.setItem(key, JSON.stringify(s.value)); } catch { /* private mode */ }
  };
  return [s, set];
}
