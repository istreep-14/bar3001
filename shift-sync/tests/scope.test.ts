import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCOPE, PRESETS, sameScope } from '../src/lib/scope.ts';

test('the default period is the 30-day preset, as its own object', () => {
  assert.notEqual(DEFAULT_SCOPE, PRESETS[1]!.scope);
  assert.equal(sameScope(DEFAULT_SCOPE, PRESETS[1]!.scope), true);
  assert.deepEqual(DEFAULT_SCOPE, { mode: 'last', n: 30, unit: 'days' });
});
