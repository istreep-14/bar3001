import test from 'node:test';
import assert from 'node:assert/strict';
import { tierOf } from '../src/ui/useWidth.ts';

test('a sheet picks its tier from its own width in rem', () => {
  assert.equal(tierOf(51.75), 'wide');     // 1440 with the side panel
  assert.equal(tierOf(41.75), 'mid');      // 1280 with the side panel
  assert.equal(tierOf(23.4), 'narrow');    // a phone
  assert.equal(tierOf(36), 'mid');         // the break itself is the wider tier
  assert.equal(tierOf(46), 'wide');
});

test('a view can move the breaks, and an unmeasured sheet takes the fallback', () => {
  assert.equal(tierOf(46.5, { mid: 47 }), 'mid');
  assert.equal(tierOf(30, { narrow: 26 }), 'mid');
  assert.equal(tierOf(null), 'wide');
  assert.equal(tierOf(null, {}, 'narrow'), 'narrow');
});
