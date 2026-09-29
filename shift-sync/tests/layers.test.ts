import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/* Where a file lives says what it may import (README, "How the code is wired"). Every import in src/ is found (single or
 * double quotes, `import`, `export ... from`, `import()`), resolved to the file it names, and checked against its layer's
 * list, so a different relative depth, a re-export or a quote style can't slip past. */
const SRC = resolve(import.meta.dirname, '../src');
const walk = (d: string): string[] => readdirSync(d).flatMap(f => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') ? [p] : [];
});
const IMPORT = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;

/** A src-relative path's layer: 'lib', 'ui', 'parts', 'data', 'core', 'features/<page>', or the top-level file's name. */
const layer = (rel: string) => { const [a, b] = rel.split('/'); return a === 'features' ? `features/${b}` : rel.includes('/') ? a! : rel; };

/** What each layer may import, as layers or src-relative files. External packages are allowed unless listed in `noPkg`. */
const RULES: Record<string, { may: (to: string, toRel: string, from: string) => boolean; noPkg?: string[] }> = {
  core: { may: () => false },
  lib: { may: to => to === 'lib' || to === 'core', noPkg: ['preact', '@preact/signals'] },
  data: { may: to => ['data', 'lib', 'core'].includes(to) },
  ui: { may: (to, rel) => ['ui', 'lib', 'core', 'router.ts', 'styles', 'assets'].includes(to) || rel === 'data/scope.ts' || rel === 'data/persisted.ts' },
  parts: { may: (to, rel) => ['parts', 'ui', 'lib', 'core', 'router.ts', 'styles', 'assets'].includes(to) || rel === 'data/store.ts' || rel === 'data/sync.ts' },
  features: { may: (to, _rel, from) => to === from || ['parts', 'ui', 'data', 'lib', 'core', 'router.ts', 'styles', 'assets'].includes(to) },
  'router.ts': { may: () => false },
  'app.tsx': { may: to => to.startsWith('features/') || ['parts', 'ui', 'router.ts', 'data', 'styles', 'app.module.css'].includes(to) },
  'main.tsx': { may: () => true }
};

test('every import in src/ keeps to its layer', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file), from = layer(rel), rule = RULES[from.startsWith('features/') ? 'features' : from];
    assert.ok(rule, `${rel}: no rule for layer "${from}"`);
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = (m[1] ?? m[2] ?? m[3])!;
      seen++;
      if (!spec.startsWith('.')) { if (rule.noPkg?.some(p => spec === p || spec.startsWith(p + '/'))) bad.push(`${rel} imports ${spec}`); continue; }
      const toRel = relative(SRC, resolve(dirname(file), spec));
      if (toRel.startsWith('..')) { bad.push(`${rel} reaches outside src/: ${spec}`); continue; }
      if (!rule.may(layer(toRel), toRel, from)) bad.push(`${rel} (${from}) imports ${toRel}`);
    }
  }
  assert.ok(seen > 300, `only ${seen} imports found: the pattern has stopped matching`);
  assert.deepEqual(bad, []);
});
