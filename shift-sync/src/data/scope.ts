import { persisted } from './persisted.ts';
import { today } from '../lib/dates.ts';
import { DEFAULT_SCOPE, MAX_N, applyScope, clampN, labelOf } from '../lib/scope.ts';
import type { Scope, Unit } from '../lib/scope.ts';
import type { ShiftView } from '../lib/stats.ts';

/* The one period every data screen shares. Persisted, and untouched by navigation:
 * go from the Log to Totals and you are looking at the same window. */
const KEY = 'scope2';
const UNITS = ['days', 'weeks', 'months', 'years', 'shifts'];
const isYmd = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** A scope read back from storage. JSON is untyped, so this narrows `unknown` instead of trusting the shape. */
const valid = (s: unknown): s is Scope => {
  if (!s || typeof s !== 'object') return false;
  const o = s as { mode?: unknown; n?: unknown; unit?: unknown; from?: unknown; to?: unknown };
  if (o.mode === 'all') return true;
  if (o.mode === 'last') return typeof o.n === 'number' && clampN(o.n) === o.n && typeof o.unit === 'string' && UNITS.includes(o.unit);
  return o.mode === 'range' && isYmd(o.from) && isYmd(o.to);
};
export const [scope, setScope] = persisted<Scope>(KEY, valid, DEFAULT_SCOPE);
export const setLast = (n: number, unit: Unit) => setScope({ mode: 'last', n: Math.min(MAX_N, n), unit });

export const scopedViews = (views: ShiftView[]): ShiftView[] => applyScope(views, scope.value, today());
export const scopeLabel = (): string => labelOf(scope.value, today());
