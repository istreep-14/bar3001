import test from 'node:test';
import assert from 'node:assert/strict';
import { oneOf, persisted, persistedObject } from '../src/data/persisted.ts';

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
};
const isView = oneOf(['month', 'stack'] as const);

test('reads a saved choice, writes JSON back, and falls back when nothing is saved', () => {
  const store = memory();
  const [v, set] = persisted('view', isView, 'month', store);
  assert.equal(v.value, 'month');
  set('stack');
  assert.equal(v.value, 'stack');
  assert.equal(store.m.get('view'), '"stack"');
  assert.equal(persisted('view', isView, 'month', store)[0].value, 'stack');
});

test('a plain string saved by an older build still reads back', () => {
  assert.equal(persisted('view', isView, 'month', memory({ view: 'stack' }))[0].value, 'stack');
  assert.equal(persisted('size', oneOf([25, 50, 100] as const), 50, memory({ size: '100' }))[0].value, 100);
});

test('a settings bag merges over its defaults and ignores a value that is not an object', () => {
  const store = memory({ conf: JSON.stringify({ api: 'https://example.test/exec' }) });
  const defaults = { api: '', token: '', theme: 'system' as const };
  const [v, set] = persistedObject('conf', defaults, store);
  assert.deepEqual(v.value, { api: 'https://example.test/exec', token: '', theme: 'system' });
  set({ token: 'abc' });
  assert.equal(v.value.token, 'abc');
  assert.equal(JSON.parse(store.m.get('conf')!).token, 'abc');
  assert.deepEqual(persistedObject('conf', defaults, memory({ conf: '"nope"' }))[0].value, defaults);
  assert.deepEqual(persistedObject('conf', defaults, memory({ conf: '[]' }))[0].value, defaults);
});

test('an invalid or unreadable value falls back instead of breaking the page', () => {
  assert.equal(persisted('view', isView, 'month', memory({ view: 'bogus' }))[0].value, 'month');
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const [v, set] = persisted('view', isView, 'month', broken);
  assert.equal(v.value, 'month');
  set('stack');                       // storage refuses the write; the choice still applies for this visit
  assert.equal(v.value, 'stack');
  assert.equal(persisted('view', isView, 'month', null)[0].value, 'month');
});
