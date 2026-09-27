import test from 'node:test';
import assert from 'node:assert/strict';
import { bandPaths, buildEntries, paginate, paginateEntries, sortRows } from '../src/lib/table.ts';

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

/* ── bands ── */
type R = { id: string; d: string };
const rows: R[] = [
  { id: 'a', d: '2026-09-25' }, { id: 'b', d: '2026-09-24' }, { id: 'c', d: '2026-09-15' },   // Sep: two weeks
  { id: 'd', d: '2026-08-30' }                                                                    // Aug
];
const month = { id: 'month', key: (r: R) => r.d.slice(0, 7), label: (r: R) => r.d.slice(0, 7) };
const week = { id: 'week', key: (r: R) => (r.d < '2026-09-20' ? (r.d < '2026-09-13' ? 'w-aug' : 'w2') : 'w3'), label: (r: R) => 'wk ' + r.id };
const shape = (es: ReturnType<typeof buildEntries<R>>) => es.map(e => (e.kind === 'row' ? e.row.id : `[${e.level}:${e.label}${e.collapsed ? '*' : ''}]`)).join(' ');

test('bands: no bands is just rows; one level inserts a header per change', () => {
  assert.equal(shape(buildEntries(rows, [], new Set())), 'a b c d');
  assert.equal(shape(buildEntries(rows, [month], new Set())), '[0:2026-09] a b c [0:2026-08] d');
});

test('bands: nested levels, header summary rows include every member', () => {
  const es = buildEntries(rows, [month, week], new Set());
  assert.equal(shape(es), '[0:2026-09] [1:wk a] a b [1:wk c] c [0:2026-08] [1:wk d] d');
  const sep = es.find(e => e.kind === 'band' && e.level === 0) as any;
  assert.deepEqual(sep.rows.map((r: R) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(bandPaths(rows, [month, week]).length, 5);
});

test('bands: collapsing a band hides its rows and any deeper headers, keeps its own header', () => {
  const sep = 'month:2026-09';
  assert.equal(shape(buildEntries(rows, [month, week], new Set([sep]))), '[0:2026-09*] [0:2026-08] [1:wk d] d');
  assert.equal(shape(buildEntries(rows, [month, week], new Set([sep + '/week:w3']))), '[0:2026-09] [1:wk a*] [1:wk c] c [0:2026-08] [1:wk d] d');
});

test('bands: paging counts rows only; headers ride with their first row', () => {
  const es = buildEntries(rows, [month], new Set());
  const p0 = paginateEntries(es, 2, 0), p1 = paginateEntries(es, 2, 1);
  assert.equal(shape(p0.entries), '[0:2026-09] a b');
  assert.equal(shape(p1.entries), 'c [0:2026-08] d');
  assert.deepEqual([p0.total, p0.pages, p1.from, p1.to], [4, 2, 3, 4]);
  // everything collapsed: no rows, but the headers still show
  const all = buildEntries(rows, [month], new Set(['month:2026-09', 'month:2026-08']));
  assert.equal(shape(paginateEntries(all, 2, 0).entries), '[0:2026-09*] [0:2026-08*]');
});
