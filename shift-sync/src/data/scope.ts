import { persisted } from './persisted.ts';
import { today } from '../lib/dates.ts';
import { DEFAULT_SCOPE, MAX_N, applyScope, clampN, labelOf } from '../lib/scope.ts';
import type { Scope, Unit } from '../lib/scope.ts';
import type { ShiftView } from '../lib/stats.ts';

/* The one period every data screen shares. Persisted, and untouched by navigation:
 * go from Log to Rate and you are looking at the same window. */
const KEY = 'scope2';
const valid = (s: any): s is Scope =>
  !!s && (s.mode === 'all' || (s.mode === 'last' && clampN(s.n) === s.n && ['days', 'weeks', 'months', 'years', 'shifts'].includes(s.unit)) ||
    (s.mode === 'range' && /^\d{4}-\d{2}-\d{2}$/.test(s.from) && /^\d{4}-\d{2}-\d{2}$/.test(s.to)));
export const [scope, setScope] = persisted<Scope>(KEY, valid, DEFAULT_SCOPE);
export const setLast = (n: number, unit: Unit) => setScope({ mode: 'last', n: Math.min(MAX_N, n), unit });

export const scopedViews = (views: ShiftView[]): ShiftView[] => applyScope(views, scope.value, today());
export const scopeLabel = (): string => labelOf(scope.value, today());
