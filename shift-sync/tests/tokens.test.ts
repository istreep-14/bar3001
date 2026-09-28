import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* tokens.css writes the dark palette twice: once for the OS preference, once for the manual switch (CSS can't share a
 * block between a media query and a selector). The two must stay identical; this checks it so nobody has to by hand. */
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (start: string): Map<string, string> => {
  const i = css.indexOf(start);
  assert.ok(i >= 0, `no block starting ${start}`);
  const open = css.indexOf('{', i), close = css.indexOf('}', open);
  const decls = new Map<string, string>();
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) decls.set(m[1]!, m[2]!.trim());
  return decls;
};

test('the two dark palettes in tokens.css are identical', () => {
  const os = block(":root:not([data-theme='light'])"), manual = block(":root[data-theme='dark']");
  assert.ok(os.size > 20, 'the OS dark block was found and parsed');
  assert.deepEqual([...manual.entries()].sort(), [...os.entries()].sort());
});
