import { computed, signal } from '@preact/signals';
import { reconcileClient, stripLocal } from '../core/core.generated.js';
import type { Crew, Income, Local, Role, Shift, Staff, Wage } from '../core/core.generated.js';
import { replaceAll } from './db.ts';
import { connected, settings } from './settings.ts';
import { crewRows, incomeRows, roleRows, setChangeHandler, shifts, staffRows, wageRows } from './store.ts';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'failed' | 'unconfigured';
export const syncState = signal<SyncState>('idle');
export const syncMessage = signal('');
/** Problems the Sheet reported (typo'd rows). Shown until the next clean sync. */
export const sheetProblems = signal<string[]>([]);
const LAST = 'lastSynced';
export const lastSynced = signal<number>(Number(localStorage.getItem(LAST)) || 0);

export const state = computed<SyncState>(() => (!connected() ? 'unconfigured' : syncState.value));

interface Reply {
  error?: string;
  rows: Shift[]; income: Income[]; staff?: Staff[]; crew?: Crew[]; wages?: Wage[]; roles?: Role[]; held: string[]; held_income: string[]; held_staff?: string[]; held_crew?: string[]; held_wages?: string[]; held_roles?: string[];
  errors: { table: string; source: 'sheet' | 'app'; row?: number; id?: string; error: string }[];
}

let running = false, again = false;

/* Staff fields newer than some deployed Sheet scripts. An older script drops them and hands the row back without them; taking
 * that copy would wipe them here too (and a main role, already moved out of `roles`, would be lost outright). So while the
 * script is behind, these fields are kept from this device and the row stays unsynced, sent again each time, until a script
 * that knows them echoes them back. */
const NEW_STAFF = ['aliases', 'photo', 'avatar_color', 'avatar_text', 'role'] as const;
const hasNewStaff = (p: Local<Staff>) => !!(p.role || p.photo || p.avatar_color || p.avatar_text || p.aliases?.length);
const STALE = 'The Sheet\'s script is older than this app, so main roles, aliases, photos, avatar colours and role colours are kept on this device only. Re-paste Code.gs and core.gs, run setup, and deploy a new version.';

export async function sync(): Promise<void> {
  if (!connected()) return;
  if (!navigator.onLine) { syncState.value = 'offline'; return; }
  if (running) { again = true; return; }
  running = true; syncState.value = 'syncing'; syncMessage.value = '';
  try {
    const dirtyRows = Object.values(shifts.value).filter(r => r._dirty).map(stripLocal);
    const dirtyIncome = Object.values(incomeRows.value).filter(r => r._dirty).map(stripLocal);
    const dirtyStaff = Object.values(staffRows.value).filter(r => r._dirty).map(stripLocal);
    const dirtyCrew = Object.values(crewRows.value).filter(r => r._dirty).map(stripLocal);
    const dirtyWages = Object.values(wageRows.value).filter(r => r._dirty).map(stripLocal);
    const dirtyRoles = Object.values(roleRows.value).filter(r => r._dirty).map(stripLocal);
    const { api, token } = settings.value;
    // No Content-Type header on purpose: text/plain avoids a CORS preflight Apps Script can't answer.
    const res = await fetch(api, { method: 'POST', body: JSON.stringify({ token, rows: dirtyRows, income: dirtyIncome, staff: dirtyStaff, crew: dirtyCrew, wages: dirtyWages, roles: dirtyRoles }) });
    const data = (await res.json()) as Reply;
    if (data.error) throw new Error(data.error === 'auth' ? 'Token rejected. Check the connection settings.' : data.error);
    // Reconcile against the live signals, so edits made while the request was in flight survive.
    shifts.value = reconcileClient(shifts.value, data.rows, data.held);
    incomeRows.value = reconcileClient(incomeRows.value, data.income ?? [], data.held_income);
    // A deployment from before the Staff / Crew / Wages / Roles tabs returns no `staff` / `crew` / `wages` / `roles` at all. Leave the local copy alone then.
    const stale = !!data.staff?.length && NEW_STAFF.some(k => !(k in data.staff![0]!));
    if (data.staff) {
      const local = staffRows.value;
      const server = stale ? data.staff.map(r => {
        const l = local[r.id];
        return l ? { ...r, ...Object.fromEntries(NEW_STAFF.map(k => [k, l[k] ?? null])), aliases: l.aliases ?? [] } as Staff : r;
      }) : data.staff;
      const merged = reconcileClient(local, server, data.held_staff);
      if (stale) for (const [id, p] of Object.entries(merged)) if (!p._dirty && hasNewStaff(p)) merged[id] = { ...p, _dirty: true };
      staffRows.value = merged;
    }
    if (data.crew) crewRows.value = reconcileClient(crewRows.value, data.crew, data.held_crew);
    if (data.wages) wageRows.value = reconcileClient(wageRows.value, data.wages, data.held_wages);
    if (data.roles) roleRows.value = reconcileClient(roleRows.value, data.roles, data.held_roles);
    await replaceAll(Object.values(shifts.value), Object.values(incomeRows.value), Object.values(staffRows.value), Object.values(crewRows.value), Object.values(wageRows.value), Object.values(roleRows.value));
    sheetProblems.value = [...(stale || (!data.roles && Object.keys(roleRows.value).length) ? [STALE] : []), ...(data.errors ?? []).map(e =>
      e.source === 'sheet' ? `${e.table} sheet, row ${e.row}: ${e.error}` : `${e.table} ${e.id}: ${e.error}`)];
    localStorage.setItem(LAST, String((lastSynced.value = Date.now())));
    syncState.value = 'idle';
  } catch (err) {
    syncState.value = 'failed';
    syncMessage.value = err instanceof Error ? err.message : 'Sync failed';
    console.error(err);
  } finally {
    running = false;
  }
  if (again) { again = false; void sync(); }
}

export function startSync() {
  setChangeHandler(() => void sync());
  window.addEventListener('online', () => void sync());
  window.addEventListener('offline', () => { syncState.value = 'offline'; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
  void sync();
}
