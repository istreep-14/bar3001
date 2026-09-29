import type { Crew, Income, Local, Role, Shift, Staff, Wage } from '../core/core.generated.js';

/* Tiny typed IndexedDB wrapper. The DB name and the `rows` store are unchanged from v1,
 * so shifts already on a device survive the upgrade. */
const NAME = 'shifts';
const VERSION = 6;

interface Tables { rows: Local<Shift>; income: Local<Income>; staff: Local<Staff>; crew: Local<Crew>; wages: Local<Wage>; roles: Local<Role> }
export type TableName = keyof Tables;

const dbp: Promise<IDBDatabase> = new Promise((res, rej) => {
  const r = indexedDB.open(NAME, VERSION);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('rows')) db.createObjectStore('rows', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('income')) db.createObjectStore('income', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('staff')) db.createObjectStore('staff', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('crew')) db.createObjectStore('crew', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('wages')) db.createObjectStore('wages', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('roles')) db.createObjectStore('roles', { keyPath: 'id' });
  };
  r.onsuccess = () => {
    // A newer build opened the database in another tab and needs to upgrade it: let go, or that tab waits forever, and
    // reload into the new build.
    r.result.onversionchange = () => { r.result.close(); location.reload(); };
    res(r.result);
  };
  r.onerror = () => rej(r.error);
});

async function run<T>(names: TableName[], mode: IDBTransactionMode, fn: (s: Record<TableName, IDBObjectStore>) => IDBRequest | void): Promise<T> {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction(names, mode);
    const stores = {} as Record<TableName, IDBObjectStore>;
    names.forEach(n => { stores[n] = t.objectStore(n); });
    const req = fn(stores);
    t.oncomplete = () => res((req ? req.result : undefined) as T);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const loadAll = <K extends TableName>(name: K) =>
  run<Tables[K][]>([name], 'readonly', s => s[name].getAll());

/** Upsert records in one transaction. */
export const putMany = <K extends TableName>(name: K, records: Tables[K][]) =>
  run<void>([name], 'readwrite', s => { records.forEach(r => s[name].put(r)); });

export type AllTables = { [K in TableName]: Tables[K][] };
type AnyRow = Local<{ id: string; updated_at: number }>;

/** Writes the merged set a sync hands back, every table in one transaction. What the database holds is read in that same
 *  transaction: a row stored as unsynced that the set lacks, or has an older copy of, is another tab's work this tab
 *  never saw. It is kept (not dropped, not overwritten) and returned, so the caller can take it in and send it. */
export async function saveSynced(next: AllTables): Promise<AllTables> {
  const db = await dbp;
  const names = Object.keys(next) as TableName[];
  const kept = Object.fromEntries(names.map(n => [n, []])) as unknown as Record<TableName, AnyRow[]>;
  return new Promise((res, rej) => {
    const t = db.transaction(names, 'readwrite');
    for (const n of names) {
      const store = t.objectStore(n), want = new Map((next[n] as AnyRow[]).map(r => [r.id, r]));
      const req = store.getAll() as IDBRequest<AnyRow[]>;
      req.onsuccess = () => {
        for (const had of req.result) {
          const w = want.get(had.id);
          if (had._dirty && (!w || had.updated_at > w.updated_at)) { kept[n].push(had); want.delete(had.id); }
          else if (!w) store.delete(had.id);
        }
        want.forEach(r => store.put(r));
      };
    }
    t.oncomplete = () => res(kept as unknown as AllTables);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
