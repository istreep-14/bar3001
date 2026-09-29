import test from 'node:test';
import assert from 'node:assert/strict';
import { clockArc, lean, span, standing } from '../src/lib/meters.ts';

const h = (n: number) => n * 60;

test('standing: the share below, ties counted half; null under two values', () => {
  const v = [10, 20, 30, 40];
  assert.equal(standing(v, 5), 0);
  assert.equal(standing(v, 45), 1);
  assert.equal(standing(v, 30), 0.625);
  assert.equal(standing([10, null, 20], 15), 0.5);
  assert.equal(standing([10], 10), null);
});

test('lean: -1 at the bottom, 0 in the middle, 1 at the top', () => {
  assert.equal(lean(0), -1);
  assert.equal(lean(0.5), 0);
  assert.equal(lean(0.75), 0.5);
  assert.equal(lean(1), 1);
});

test('span: a shift ending at or before its start runs past midnight', () => {
  assert.deepEqual(span(h(17), h(23)), [h(17), h(23)]);
  assert.deepEqual(span(h(18), h(2)), [h(18), h(26)]);
  assert.deepEqual(span(h(18), h(18)), [h(18), h(18)]);   // no time, as hoursWorked counts it: not a full day
});

test('clockArc: start on a 12-hour face, sweep by hours, a full turn at most', () => {
  assert.deepEqual(clockArc(h(18), h(2)), { from: 180, sweep: 240 });      // 6p to 2a: from the 6, eight hours round
  assert.deepEqual(clockArc(h(11), h(17) + 30), { from: 330, sweep: 195 }); // 11a to 5:30p
  assert.deepEqual(clockArc(h(9), h(23)), { from: 270, sweep: 360 });       // fourteen hours fill the face
});

test('scaleColor: plain in the middle, mixed toward green above and red below', async () => {
  const { scaleColor } = await import('../src/lib/meters.ts');
  assert.equal(scaleColor(0, 'var(--ink)', 70), 'var(--ink)');
  assert.equal(scaleColor(1, 'var(--ink)', 70), 'color-mix(in srgb, var(--good) 70%, var(--ink))');
  assert.equal(scaleColor(-0.5, 'var(--ink)', 80), 'color-mix(in srgb, var(--bad) 40%, var(--ink))');
});
