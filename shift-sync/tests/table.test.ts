import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate, sortRows } from '../src/lib/table.ts';

test('sort: numbers numerically, text alphabetically, ties keep order', () => {
  const rows = [{ id: 'a', v: 10 }, { id: 'b', v: 9 }, { id: 'c', v: 10 }];
  assert.deepEqual(sortRows(rows, r => r.v, 'asc').map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(sortRows(rows, r => r.v, 'desc').map(r => r.id), ['a', 'c', 'b']);
  assert.deepEqual(sortRows([{ v: 'pear' }, { v: 'Apple' }, { v: 'fig' }], r => r.v, 'asc').map(r => r.v), ['Apple', 'fig', 'pear']);
});

test('sort: blanks go last in both directions', () => {
  const rows = [{ id: 'n', v: null }, { id: 'a', v: 1 }, { id: 'e', v: '' }, { id: 'b', v: 2 }];
  assert.deepEqual(sortRows(rows, r => r.v, 'asc').map(r => r.id), ['a', 'b', 'n', 'e']);
  assert.deepEqual(sortRows(rows, r => r.v, 'desc').map(r => r.id), ['b', 'a', 'n', 'e']);
});

test('paginate: slices, reports the visible range, clamps the page, 0 = all', () => {
  const rows = Array.from({ length: 23 }, (_, i) => i);
  const p0 = paginate(rows, 10, 0);
  assert.deepEqual([p0.rows.length, p0.from, p0.to, p0.pages], [10, 1, 10, 3]);
  const p2 = paginate(rows, 10, 2);
  assert.deepEqual([p2.rows, p2.from, p2.to], [[20, 21, 22], 21, 23]);
  assert.equal(paginate(rows, 10, 99).page, 2);
  assert.equal(paginate(rows, 10, -3).page, 0);
  assert.deepEqual([paginate(rows, 0, 5).rows.length, paginate(rows, 0, 5).pages], [23, 1]);
  assert.deepEqual([paginate([], 10, 0).from, paginate([], 10, 0).to], [0, 0]);
});
