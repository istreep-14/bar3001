import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_NAMES } from '../src/core/core.generated.js';
import { SWATCHES } from '../src/ui/swatches.ts';

test('the colour names the Sheet accepts are exactly the swatches the app can draw', () => {
  assert.deepEqual(SWATCHES.map(s => s.id).sort(), [...COLOR_NAMES].sort());
});
