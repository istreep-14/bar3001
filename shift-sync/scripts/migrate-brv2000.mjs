/* node scripts/migrate-brv2000.mjs <brv2000 data dir>... [--skip 2222-05-01]
 * Reads config.json + shifts/*.json from each dir (later dirs fill in dates the earlier ones lack)
 * and writes migration/brv2000.json, which Settings > Import reads. */
import fs from 'node:fs';
import path from 'node:path';
import { convert } from './brv2000.mjs';

const args = process.argv.slice(2);
const skipAt = args.indexOf('--skip');
const skipDates = skipAt >= 0 ? args.splice(skipAt).slice(1) : [];
if (!args.length) { console.error('usage: node scripts/migrate-brv2000.mjs <data dir>... [--skip YYYY-MM-DD ...]'); process.exit(1); }

let config = null;
const byDate = new Map();
for (const dir of args) {
  const cfg = path.join(dir, 'config.json');
  if (!config && fs.existsSync(cfg)) config = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  const sd = path.join(dir, 'shifts');
  for (const f of fs.existsSync(sd) ? fs.readdirSync(sd).filter(n => n.endsWith('.json')) : []) {
    const s = JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8'));
    if (!byDate.has(s.date)) byDate.set(s.date, s);
  }
}
const bundle = convert({ config, shifts: [...byDate.values()], skipDates });
fs.mkdirSync('migration', { recursive: true });
fs.writeFileSync('migration/brv2000.json', JSON.stringify(bundle, null, 2));
console.log(`shifts ${bundle.rows.length}, crew ${bundle.crew.length}, income ${bundle.income.length}, roster ${bundle.staff.length}, wages ${bundle.wages.length}` + (bundle.skipped.length ? `, skipped ${bundle.skipped.join(' ')}` : ''));
for (const n of bundle.notes) console.log('note:', n);
