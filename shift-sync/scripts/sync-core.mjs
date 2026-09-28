// core/core.js is the single source of the sync rules. It has to stay plain
// ES5-style script so Apps Script can run it. This script derives the two other
// copies so nobody pastes by hand:
//   apps-script/core.gs             verbatim copy, paste/clasp-push into the Sheet project
//   src/core/core.generated.*       same code plus ES exports for the Vite app
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const p = (rel) => new URL(rel, root);
const src = readFileSync(p('core/core.js'), 'utf8');
const names = Object.keys(createRequire(import.meta.url)(p('core/core.js').pathname));

writeFileSync(p('apps-script/core.gs'), src);
// src/core/ holds only generated files and is gitignored, so a fresh clone (or CI) doesn't have it yet.
mkdirSync(p('src/core/'), { recursive: true });
// The CommonJS export shim only exists for Node tests; the ES export below replaces it.
const esm = src.slice(0, src.indexOf("if (typeof module !== 'undefined')"));
writeFileSync(p('src/core/core.generated.js'),
  '/* GENERATED from core/core.js by scripts/sync-core.mjs. Do not edit. */\n' + esm +
  '\nexport { ' + names.join(', ') + ' };\n');
copyFileSync(p('core/core.d.ts'), p('src/core/core.generated.d.ts'));
console.log('core synced:', names.length, 'exports');
