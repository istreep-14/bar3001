import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCOPE, PRESETS, priorLabel, priorScope, priorViews, sameScope } from '../src/lib/scope.ts';

test('the default period is the 30-day preset, as its own object', () => {
  assert.notEqual(DEFAULT_SCOPE, PRESETS[1]!.scope);
  assert.equal(sameScope(DEFAULT_SCOPE, PRESETS[1]!.scope), true);
  assert.deepEqual(DEFAULT_SCOPE, { mode: 'last', n: 30, unit: 'days' });
});

const at = (date: string, start: number | null = 1080) => ({ shift: { date, start } });

test('priorScope: the equal span that ends the day before the current one starts', () => {
  const today = '2026-10-02';
  // 30 days runs Sep 3 – Oct 2, so the 30 before are Aug 4 – Sep 2
  assert.deepEqual(priorScope({ mode: 'last', n: 30, unit: 'days' }, today), { mode: 'range', from: '2026-08-04', to: '2026-09-02' });
  assert.deepEqual(priorScope({ mode: 'last', n: 7, unit: 'days' }, today), { mode: 'range', from: '2026-09-19', to: '2026-09-25' });
  assert.deepEqual(priorScope({ mode: 'last', n: 2, unit: 'weeks' }, today), { mode: 'range', from: '2026-09-05', to: '2026-09-18' });
  // a month (Sep 3 – Oct 2) before is Aug 3 – Sep 2
  assert.deepEqual(priorScope({ mode: 'last', n: 1, unit: 'months' }, today), { mode: 'range', from: '2026-08-03', to: '2026-09-02' });
  assert.deepEqual(priorScope({ mode: 'last', n: 1, unit: 'years' }, today), { mode: 'range', from: '2024-10-03', to: '2025-10-02' });
  assert.equal(priorScope({ mode: 'all' }, today), null);
});

test('priorScope: a custom range is compared with the same number of days before it', () => {
  assert.deepEqual(priorScope({ mode: 'range', from: '2026-09-01', to: '2026-09-30' }, '2026-10-02'), { mode: 'range', from: '2026-08-02', to: '2026-08-31' });
  assert.deepEqual(priorScope({ mode: 'range', from: '2026-03-01', to: '2026-03-01' }, '2026-10-02'), { mode: 'range', from: '2026-02-28', to: '2026-02-28' });
});

test('priorScope and priorViews: the last N shifts are compared with the N before them', () => {
  const views = [at('2026-09-30'), at('2026-09-28'), at('2026-09-28', 600), at('2026-09-20'), at('2026-09-10'), at('2026-09-01')];
  const s = { mode: 'last' as const, n: 2, unit: 'shifts' as const };
  // newest two are Sep 30 and Sep 28 (the 6 PM one); the next two are Sep 28 (10 AM) and Sep 20
  assert.deepEqual(priorViews(views, s, '2026-10-02')!.map(v => [v.shift.date, v.shift.start]), [['2026-09-28', 600], ['2026-09-20', 1080]]);
  assert.deepEqual(priorScope(s, '2026-10-02', views), { mode: 'range', from: '2026-09-20', to: '2026-09-28' });
  assert.equal(priorScope({ mode: 'last', n: 9, unit: 'shifts' }, '2026-10-02', views), null);   // nothing older
  assert.equal(priorViews(views, { mode: 'all' }, '2026-10-02'), null);
});

test('priorViews for a date scope keeps the shifts of the span before, open-ended on neither side', () => {
  const views = [at('2026-10-01'), at('2026-09-03'), at('2026-09-02'), at('2026-08-04'), at('2026-08-03')];
  assert.deepEqual(priorViews(views, { mode: 'last', n: 30, unit: 'days' }, '2026-10-02')!.map(v => v.shift.date), ['2026-09-02', '2026-08-04']);
});

test('priorLabel says the period before in words, a custom range by its dates', () => {
  const today = '2026-10-02';
  assert.equal(priorLabel({ mode: 'last', n: 30, unit: 'days' }, today), 'the 30 days before');
  assert.equal(priorLabel({ mode: 'last', n: 1, unit: 'months' }, today), 'the month before');
  assert.equal(priorLabel({ mode: 'last', n: 20, unit: 'shifts' }, today), 'the 20 shifts before');
  assert.equal(priorLabel({ mode: 'range', from: '2026-09-02', to: '2026-10-01' }, today), 'Aug 3 – Sep 1');
  assert.equal(priorLabel({ mode: 'range', from: '2026-01-10', to: '2026-01-19' }, today), 'Dec 31, 2025 – Jan 9');
  assert.equal(priorLabel({ mode: 'all' }, today), null);
});
