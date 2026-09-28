import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/* Where a component lives says what it may touch:
 *   src/ui/      generic parts, driven by props (they may navigate, never read or write data)
 *   src/parts/   domain parts more than one page uses (a shift's card, the grouped list); may read the store
 *   src/features/<page>/  one page and the parts only it uses */
const files = (dir: string) => readdirSync(new URL(`../src/${dir}/`, import.meta.url)).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
const read = (dir: string, f: string) => readFileSync(new URL(`../src/${dir}/${f}`, import.meta.url), 'utf8');

test('ui/ parts never import the store or sync', () => {
  for (const f of files('ui')) assert.doesNotMatch(read('ui', f), /from '\.\.\/data\/(store|sync)\.ts'/, `ui/${f} reads data; it belongs in parts/`);
});

test('parts/ never import a page', () => {
  for (const f of files('parts')) assert.doesNotMatch(read('parts', f), /from '\.\.\/features\//, `parts/${f} imports a page`);
});
