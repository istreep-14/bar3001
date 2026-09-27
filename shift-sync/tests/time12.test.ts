import test from 'node:test';
import assert from 'node:assert/strict';
import { from12, minuteOptions, to12 } from '../src/lib/time12.ts';

test('24-hour strings split into 12-hour parts', () => {
  assert.deepEqual(to12('18:00'), { h: 6, m: 0, pm: true });
  assert.deepEqual(to12('02:30'), { h: 2, m: 30, pm: false });
  assert.deepEqual(to12('00:15'), { h: 12, m: 15, pm: false });
  assert.deepEqual(to12('12:00'), { h: 12, m: 0, pm: true });
  assert.equal(to12(''), null);
  assert.equal(to12('24:00'), null);
  assert.equal(to12('6pm'), null);
});

test('12-hour parts join back to what the form stores, round trip included', () => {
  assert.equal(from12({ h: 6, m: 0, pm: true }), '18:00');
  assert.equal(from12({ h: 12, m: 5, pm: false }), '00:05');
  assert.equal(from12({ h: 12, m: 0, pm: true }), '12:00');
  for (const t of ['00:00', '01:10', '11:59', '12:30', '17:45', '23:55']) assert.equal(from12(to12(t)!), t);
});

test('minutes come every five, keeping an odd one that is already set', () => {
  assert.equal(minuteOptions(null).length, 12);
  assert.deepEqual(minuteOptions(12).slice(2, 4), [10, 12]);
  assert.equal(minuteOptions(15).length, 12);
});
