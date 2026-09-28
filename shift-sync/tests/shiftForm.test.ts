import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER, check, flaggedPages, newLine, newMember, pageOfError } from '../src/features/shift/form/model.ts';
import type { Form } from '../src/features/shift/form/model.ts';

const form = (o: Partial<Form> = {}): Form => ({ date: '2026-09-24', start: '18:00', end: '02:30', type: 'night', party: false, tips: '329', notes: '', lines: [], crew: [], ...o });

test('a complete shift passes and parses to what gets saved', () => {
  const c = check(form({ crew: [newMember({ staff_id: 'p1', name: 'Bill', start: '17:00', end: '02:30' })] }), id => (id === 'p1' ? 'Billy' : undefined));
  assert.deepEqual(c.errors, {});
  assert.equal(c.start, 1080);
  assert.equal(c.end, 150);
  assert.equal(c.tips, 329);
  assert.equal(c.crew[0]!.name, 'Billy');          // the roster's current name wins over the one typed
  assert.equal(c.crew[0]!.start, 1020);
});

test('blank tips and blank times are allowed; a scheduled shift can be saved', () => {
  const c = check(form({ tips: '', end: '' }));
  assert.deepEqual(c.errors, {});
  assert.equal(c.tips, null);
  assert.equal(c.end, null);
});

test('each problem is keyed to its field', () => {
  const line = newLine({ amount: '' }), bad = newMember({ staff_id: 'p', name: 'Jo', start: '25:00' });
  const c = check(form({ date: '', start: 'soon', tips: '-5', lines: [line], crew: [bad] }));
  assert.ok(c.errors.date && c.errors.start && c.errors.tips);
  assert.equal(c.errors['line' + line.key], 'Enter an amount.');
  assert.match(c.errors['crew' + bad.key]!, /Jo/);
});

test('errors flag their pages, and Save jumps to the first in page order', () => {
  const errs = { tips: 'x', crewm1: 'y', date: 'z' };
  assert.deepEqual([...flaggedPages(errs)].sort(), ['crew', 'date', 'tips']);
  assert.equal(pageOfError(errs), 'date');
  assert.equal(pageOfError({ linel1: 'x', crewm1: 'y' }), 'misc');
  assert.equal(pageOfError({}), null);
  assert.equal(ORDER[0], 'home');
});
