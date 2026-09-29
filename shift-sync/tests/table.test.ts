import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate, pushSort, resizeWeights, sortBy } from '../src/lib/table.ts';

test('sort: numbers numerically, text alphabetically, ties keep order', () => {
  const rows = [{ id: 'a', v: 10 }, { id: 'b', v: 9 }, { id: 'c', v: 10 }];
  assert.deepEqual(sortBy(rows, [{ get: r => r.v, dir: 'asc' }]).map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(sortBy(rows, [{ get: r => r.v, dir: 'desc' }]).map(r => r.id), ['a', 'c', 'b']);
  assert.deepEqual(sortBy([{ v: 'pear' }, { v: 'Apple' }, { v: 'fig' }], [{ get: r => r.v, dir: 'asc' }]).map(r => r.v), ['Apple', 'fig', 'pear']);
});

test('sort: blanks go last in both directions', () => {
  const rows = [{ id: 'n', v: null }, { id: 'a', v: 1 }, { id: 'e', v: '' }, { id: 'b', v: 2 }];
  assert.deepEqual(sortBy(rows, [{ get: r => r.v, dir: 'asc' }]).map(r => r.id), ['a', 'b', 'n', 'e']);
  assert.deepEqual(sortBy(rows, [{ get: r => r.v, dir: 'desc' }]).map(r => r.id), ['b', 'a', 'n', 'e']);
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

test('sortBy: later keys break ties, still-tied rows keep their order, blanks last per key', () => {
  const rows = [{ id: 'a', role: 'Bar', name: 'Zed' }, { id: 'b', role: 'Host', name: 'Amy' }, { id: 'c', role: 'Bar', name: 'Ann' }, { id: 'd', role: null, name: 'Bo' }, { id: 'e', role: 'Bar', name: 'Ann' }];
  const byRoleThenName = sortBy(rows, [{ get: r => r.role, dir: 'asc' }, { get: r => r.name, dir: 'asc' }]);
  assert.deepEqual(byRoleThenName.map(r => r.id), ['c', 'e', 'a', 'b', 'd']);
  assert.deepEqual(sortBy(rows, [{ get: r => r.role, dir: 'desc' }]).map(r => r.id), ['b', 'a', 'c', 'e', 'd']);
  assert.equal(sortBy(rows, []), rows);
});

test('pushSort: the top column flips, another goes on top with the old sorts kept under it', () => {
  let s = pushSort([], 'name', 'asc');
  assert.deepEqual(s, [{ key: 'name', dir: 'asc' }]);
  s = pushSort(s, 'role', 'asc');
  assert.deepEqual(s.map(x => x.key), ['role', 'name']);
  s = pushSort(s, 'role', 'asc');
  assert.deepEqual(s[0], { key: 'role', dir: 'desc' });
  s = pushSort(pushSort(pushSort(s, 'id', 'asc'), 'status', 'asc'), 'name', 'asc');
  assert.deepEqual(s.map(x => x.key), ['name', 'status', 'id']);
});

test('resizeWeights: one column grows as its neighbour shrinks, never under the minimum', () => {
  assert.deepEqual(resizeWeights([2, 1, 1], 0, 0.5), [2.5, 0.5, 1]);
  assert.deepEqual(resizeWeights([2, 1, 1], 0, 5), [2.6, 0.4, 1]);
  assert.deepEqual(resizeWeights([2, 1, 1], 1, -5), [2, 0.4, 1.6]);
  assert.deepEqual(resizeWeights([1, 1], 1, 1), [1, 1]);
});
