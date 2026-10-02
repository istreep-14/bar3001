import test from 'node:test';
import assert from 'node:assert/strict';
import type { Income, Shift } from '../src/core/core.generated.js';
import { countMoneyLines, moneyLines } from '../src/lib/income.ts';
import { toView } from '../src/lib/stats.ts';

const shift = (o: Partial<Shift> = {}): Shift => ({ id: 'a', date: '2026-09-25', start: 1080, end: 150, tips: 329, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false, ...o });
const inc = (o: Partial<Income> = {}): Income => ({ id: 'i', shift_id: 'a', category: 'Chump', amount: 40, note: null, updated_at: 1, deleted: false, ...o });
const RATES = [{ date: '2026-01-01', rate: 5 }];

test('a shift lists tips, its estimated wage, each source in order, then an earlier entry', () => {
  const v = toView(shift({ other: 12 }), [inc({ id: 'v', category: 'Venmo', amount: 43, note: 'tab' }), inc({ id: 'c', category: 'Chump', amount: 20 }), inc({ id: 'c2', category: 'Chump', amount: 41 })], [], RATES);
  const lines = moneyLines(v);
  assert.deepEqual(lines.map(l => [l.category, l.type, l.amount]), [
    ['Tips', null, 329], ['Wage', null, 42.5], ['Other', 'Chump', 41], ['Other', 'Chump', 20], ['Other', 'Venmo', 43], ['Other', 'Other', 12]
  ]);
  assert.equal(lines.find(l => l.type === 'Venmo')!.note, 'tab');
  assert.equal(lines.at(-1)!.note, 'Earlier entry');
});

test('the count includes estimated wage lines: a shift awaiting tips still has its wage', () => {
  const worked = toView(shift({ id: 'w', tips: null }), [], [], RATES);          // clocked out, tips not in
  const upcoming = toView(shift({ id: 'u', tips: null, end: null }), [], [], RATES);   // no hours, so no wage either
  const noRate = toView(shift({ id: 'n' }), [], [], []);                          // tips only
  assert.deepEqual(moneyLines(worked).map(l => l.category), ['Wage']);
  assert.deepEqual(moneyLines(upcoming), []);
  assert.equal(countMoneyLines([worked, upcoming, noRate]), 2);
});
