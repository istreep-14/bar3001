import type { Crew, Income, Local, Shift, Staff, Wage } from '../core/core.generated.js';

/* Tiny typed IndexedDB wrapper. The DB name and the `rows` store are unchanged from v1,
 * so shifts already on a device survive the upgrade. */
const NAME = 'shifts';
const VERSION = 5;

interface Tables { rows: Local<Shift>; income: Local<Income>; staff: Local<Staff>; crew: Local<Crew>; wages: Local<Wage> }
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
  };
  r.onsuccess = () => res(r.result);
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

/** Replace all tables atomically (used after a sync hands back the full merged set). */
export const replaceAll = (rows: Local<Shift>[], income: Local<Income>[], staff: Local<Staff>[], crew: Local<Crew>[], wages: Local<Wage>[]) =>
  run<void>(['rows', 'income', 'staff', 'crew', 'wages'], 'readwrite', s => {
    s.rows.clear(); rows.forEach(r => s.rows.put(r));
    s.income.clear(); income.forEach(r => s.income.put(r));
    s.staff.clear(); staff.forEach(r => s.staff.put(r));
    s.crew.clear(); crew.forEach(r => s.crew.put(r));
    s.wages.clear(); wages.forEach(r => s.wages.put(r));
  });
