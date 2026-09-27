/* node scripts/migrate-brvflat.mjs <brv-flat data dir> [--except migration/brv2000.json] [--skip YYYY-MM-DD ...]
 * Reads shifts.csv + staff.csv + unlinked_income.csv and writes migration/brv-flat.json for Settings > Import.
 * Everything is imported unless you say otherwise. --except leaves out dates already in another bundle. */
import fs from 'node:fs';
import path from 'node:path';
import { convertFlat } from './brvflat.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const at = args.indexOf(name); if (at < 0) return []; const rest = args.splice(at); const stop = rest.findIndex((x, i) => i > 0 && x.startsWith('--')); if (stop > 0) args.push(...rest.slice(stop)); return rest.slice(1, stop > 0 ? stop : undefined); };
const except = opt('--except'), skip = opt('--skip');
const dir = args[0];
if (!dir) { console.error('usage: node scripts/migrate-brvflat.mjs <data dir> [--except bundle.json] [--skip YYYY-MM-DD ...]'); process.exit(1); }

const skipDates = [...skip];
for (const f of except) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rows) skipDates.push(r.date);
const b = convertFlat({ shiftsCsv: fs.readFileSync(path.join(dir, 'shifts.csv'), 'utf8'), staffCsv: fs.readFileSync(path.join(dir, 'staff.csv'), 'utf8'),
  unlinkedCsv: fs.existsSync(path.join(dir, 'unlinked_income.csv')) ? fs.readFileSync(path.join(dir, 'unlinked_income.csv'), 'utf8') : '', skipDates });
fs.mkdirSync('migration', { recursive: true });
fs.writeFileSync('migration/brv-flat.json', JSON.stringify(b, null, 2));
console.log(`shifts ${b.rows.length}, crew ${b.crew.length}, income ${b.income.length}, roster ${b.staff.length}` + (b.skipped.length ? `, skipped ${b.skipped.join(' ')}` : ''));
for (const n of b.notes) console.log('note:', n);
