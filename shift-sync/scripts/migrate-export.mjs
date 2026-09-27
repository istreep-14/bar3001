/* node scripts/migrate-export.mjs <shifts-YYYY-MM-DD.json> [--me-from <brv2000 data dir>]
 * Writes migration/shifts-export.json for Settings > Import.
 * --me-from: read config.json there: the roster's "is_user" person goes on every crew (you worked them all),
 *   and its wageRateTable becomes your hourly wages. */
import fs from 'node:fs';
import path from 'node:path';
import { wageOf } from './brv2000.mjs';
import { convertExport } from './shiftsexport.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--me-from');
const dir = at >= 0 ? args.splice(at, 2)[1] : null;
const file = args[0];
if (!file) { console.error('usage: node scripts/migrate-export.mjs <export.json> [--me-from <brv2000 data dir>]'); process.exit(1); }

let me = null, wages = [];
if (dir) {
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  wages = (cfg.wageRateTable ?? []).map(wageOf);
  const w = cfg.workers.find(x => x.is_user);
  if (w) me = { id: `b2k-w${w.worker_id}`, name: w.name, first: w.first_name, last: w.last_name, roles: w.positions, id_number: w.ID, manager: w.manager };
}
const b = convertExport({ shifts: JSON.parse(fs.readFileSync(file, 'utf8')), me, wages });
fs.mkdirSync('migration', { recursive: true });
fs.writeFileSync('migration/shifts-export.json', JSON.stringify(b, null, 2));
console.log(`shifts ${b.rows.length}, crew ${b.crew.length}, income ${b.income.length}, wages ${b.wages.length}, tips $${b.rows.reduce((t, r) => t + (r.tips ?? 0), 0)}`);
