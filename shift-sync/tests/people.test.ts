import test from 'node:test';
import assert from 'node:assert/strict';
import { findPeople, fold, handle, hashOf, initials, rolesOf } from '../src/lib/people.ts';

const p = (id: string, name: string, o: Partial<{ first: string; last: string; aliases: string[] }> = {}) =>
  ({ id, name, first: o.first ?? null, last: o.last ?? null, aliases: o.aliases ?? [] });
const roster = [
  p('a', 'Abby', { first: 'Abigail', last: 'Clemens', aliases: ['Abs', 'AC'] }),
  p('s', 'Sam', { first: 'Samuel', last: 'Ortiz' }),
  p('j', 'Jo', { first: 'Joanna', last: 'Reyes', aliases: ['Sammy'] }),
  p('z', 'José', { last: 'Núñez' })
];
const ids = (q: string) => findPeople(roster, q).map(m => m.person.id);

test('fold drops case, accents and extra spaces', () => {
  assert.equal(fold('  José  Núñez '), 'jose nunez');
});

test('findPeople matches the name, first, last and full name, best first', () => {
  assert.deepEqual(ids('abb'), ['a']);
  assert.deepEqual(ids('clem'), ['a']);
  assert.deepEqual(ids('abigail c'), ['a']);
  assert.deepEqual(ids('jose'), ['z']);            // accents don't matter
  assert.deepEqual(ids('nunez'), ['z']);
  assert.deepEqual(ids(''), ['a', 'j', 'z', 's']);   // blank: everyone, by name
});

test('an alias finds a person, says which alias, and loses to a name at the same strength', () => {
  const m = findPeople(roster, 'abs');
  assert.equal(m[0]!.person.id, 'a');
  assert.equal(m[0]!.via, 'Abs');
  assert.deepEqual(ids('sam'), ['s', 'j']);          // Sam by name, Jo by the alias Sammy
  assert.equal(findPeople(roster, 'sam')[1]!.via, 'Sammy');
  assert.equal(findPeople(roster, 'sam')[0]!.via, null);
  assert.deepEqual(ids('xyz'), []);
});

test('initials: the chosen letters, else the first two words, else ?', () => {
  assert.equal(initials('abby clemens'), 'AC');
  assert.equal(initials('Abby', 'Ab'), 'Ab');
  assert.equal(initials('Abby', '  '), 'A');
  assert.equal(initials('  '), '?');
  assert.equal(hashOf('p1'), hashOf('p1'));
});

test('rolesOf: the main role and the rest; an older row reads its first role as main', () => {
  assert.deepEqual(rolesOf({ role: 'Bartender', roles: ['Server', 'bartender'] }), { main: 'Bartender', others: ['Server'] });
  assert.deepEqual(rolesOf({ role: null, roles: ['Server', 'Host'] }), { main: 'Server', others: ['Host'] });
  assert.deepEqual(rolesOf({ role: null, roles: [] }), { main: null, others: [] });
});

test('handle', () => {
  assert.equal(handle(' Big  Mike '), '@Big_Mike');
});
