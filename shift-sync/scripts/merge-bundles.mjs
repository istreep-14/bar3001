/* node scripts/merge-bundles.mjs out.json in1.json in2.json ...
 * One file to import instead of several. Order matters only for a repeated id: the first one wins. */
import fs from 'node:fs';

const [out, ...ins] = process.argv.slice(2);
if (!out || !ins.length) { console.error('usage: node scripts/merge-bundles.mjs out.json in1.json in2.json ...'); process.exit(1); }
const all = { source: 'merged', staff: [], rows: [], income: [], crew: [], wages: [] };
const seen = { staff: new Set(), rows: new Set(), income: new Set(), crew: new Set(), wages: new Set() };
for (const f of ins) {
  const b = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of Object.keys(seen)) for (const r of b[k] ?? []) if (!seen[k].has(r.id)) { seen[k].add(r.id); all[k].push(r); }
}
fs.writeFileSync(out, JSON.stringify(all, null, 2));
console.log(`${out}: shifts ${all.rows.length}, crew ${all.crew.length}, income ${all.income.length}, roster ${all.staff.length}, wages ${all.wages.length}`);
