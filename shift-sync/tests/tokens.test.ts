import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

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

/* "No raw colour in a component: tokens.css only." Weights too: the four the fonts ship are tokens (--fw-*). A literal
 * font size is still allowed; snapping the rest to the --fs-* scale needs a look at each page. */
test('no CSS file but tokens.css spells out a colour or a font weight', () => {
  const root = new URL('../src/', import.meta.url);
  const files = (readdirSync(root, { recursive: true }) as string[]).filter(f => f.endsWith('.css') && !f.endsWith('tokens.css'));
  assert.ok(files.length > 20, 'the CSS files were found');
  const bad: string[] = [];
  for (const f of files) {
    const css = readFileSync(new URL(f, root), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|font-weight:\s*\d/g)) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});
