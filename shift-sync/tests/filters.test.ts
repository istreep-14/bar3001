import test from 'node:test';
import assert from 'node:assert/strict';
import { NONE, applyFilters, facet, toggleFilter } from '../src/lib/filters.ts';

const rows = [
  { id: 'a', role: 'Bar', others: ['Host'], status: 'active' },
  { id: 'b', role: 'Host', others: [], status: 'inactive' },
  { id: 'c', role: null, others: ['Bar', 'Host'], status: 'active' }
];
const fields = { role: (r: typeof rows[0]) => r.role, others: (r: typeof rows[0]) => r.others, status: (r: typeof rows[0]) => r.status };
const ids = (f: Record<string, string[]>) => applyFilters(rows, f, fields).map(r => r.id);

test('applyFilters: any picked value of a field passes; every field with picks must pass; none picked = everyone', () => {
  assert.deepEqual(ids({}), ['a', 'b', 'c']);
  assert.deepEqual(ids({ role: ['Bar', 'Host'] }), ['a', 'b']);
  assert.deepEqual(ids({ role: ['Bar', 'Host'], status: ['active'] }), ['a']);
  assert.deepEqual(ids({ others: ['Host'] }), ['a', 'c']);
  assert.deepEqual(ids({ role: [NONE] }), ['c']);
  assert.deepEqual(ids({ others: [NONE] }), ['b']);
  assert.deepEqual(ids({ role: [], nope: ['x'] }), ['a', 'b', 'c']);
});

test('facet: values with counts, most common first, none last; toggleFilter picks and unpicks', () => {
  assert.deepEqual(facet(rows, fields.others), [{ value: 'Host', count: 2 }, { value: 'Bar', count: 1 }, { value: NONE, count: 1 }]);
  let f = toggleFilter({}, 'role', 'Bar');
  assert.deepEqual(f, { role: ['Bar'] });
  f = toggleFilter(f, 'role', 'Host');
  assert.deepEqual(f, { role: ['Bar', 'Host'] });
  assert.deepEqual(toggleFilter(toggleFilter(f, 'role', 'Bar'), 'role', 'Host'), {});
});
