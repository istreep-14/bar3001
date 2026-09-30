import { hoursWorked } from '../core/core.generated.js';
import { personById } from '../data/store.ts';
import { clockPlain, dec1, hours, money, perHour } from '../lib/format.ts';
import { incomeParts } from '../lib/groups.ts';
import type { ShiftView } from '../lib/stats.ts';
import { PersonAvatar } from './PersonAvatar.tsx';
import { MixBar, MixKey } from '../ui/MixBar.tsx';
import { OpenPill } from '../ui/Badges.tsx';
import { MeBadge } from '../ui/MeBadge.tsx';
import styles from './ShiftDetails.module.css';

/* One shift, read-only, as stacked lists: Time, Crew, Money (label left, detail in the middle, amount right, a bold
 * total last), with the income mix bar over them. The same block is the drawer's body and an opened Log row, so the
 * two can never drift apart. `layout` only changes the arrangement: 'stack' in the drawer, 'columns' in a wide card.
 * `onEdit` puts an Edit link on each list, handed the form page that list is edited on. */
export type DetailsPage = 'time' | 'crew' | 'misc';
export function ShiftDetails({ v, layout, onEdit }: { v: ShiftView; layout: 'stack' | 'columns'; onEdit?: (page: DetailsPage) => void }) {
  const sh = v.shift;
  const parts = incomeParts(v);
  const cap = (label: string, page: DetailsPage, what: string) => (
    <h4 class={styles.cap}>{label}{onEdit && <button type="button" class="linkbtn" onClick={() => onEdit(page)} aria-label={`Edit ${what}`}>Edit</button>}</h4>
  );
  return (
    <div class={styles.details} data-layout={layout}>
      {parts.length > 0 && <MixBar parts={parts} labels={layout === 'columns'} />}
      <div class={styles.lists}>
        <section class={styles.list} aria-label="Time">
          {cap('Time', 'time', 'the times')}
          <dl class={styles.kv}>
            <div><dt>Start</dt><dd class="num">{clockPlain(sh.start) || ''}</dd></div>
            <div><dt>End</dt><dd class="num">{sh.end != null ? clockPlain(sh.end) : sh.start != null ? <OpenPill /> : ''}</dd></div>
            <div><dt>Hours</dt><dd class="num">{hours(v.hours)}</dd></div>
          </dl>
        </section>
        <section class={styles.list} aria-label="Crew">
          {cap('Crew', 'crew', 'the crew')}
          {v.crew.length === 0 ? <p class={styles.empty}>No bartenders logged. Edit the shift to add who worked it.</p> : (
            <dl class={styles.kv}>
              {v.crew.map(c => {
                const p = personById(c.staff_id), h = hoursWorked(c.start, c.end);
                return (
                  <div key={c.id}>
                    <dt><PersonAvatar id={c.staff_id} fallback={c.name} size="sm" />{p?.name ?? c.name ?? 'Unknown'}{p?.is_user && <MeBadge />}{c.location && <span class="spot" data-spot={c.location}>{c.location}</span>}</dt>
                    <dd class="num"><small>{clockPlain(c.start)}{c.end != null ? ` – ${clockPlain(c.end)}` : ''}</small>{c.end == null && c.start != null ? <OpenPill /> : h == null ? '' : `${dec1(h)}h`}</dd>
                  </div>
                );
              })}
              <div class={styles.total}><dt>{v.crewCount} {v.crewCount === 1 ? 'bartender' : 'bartenders'}</dt><dd class="num">{dec1(v.crewHours)}h</dd></div>
            </dl>
          )}
        </section>
        <section class={styles.list} aria-label="Money">
          {cap('Money', 'misc', 'other income')}
          <dl class={styles.kv}>
            {/* tips/hr here is this record's own arithmetic, not a ranking metric (Rate stays tips-only). */}
            <div><dt><MixKey token="--cat-tips" />Tips</dt><dd class="num">{v.tph != null && <small>{perHour(v.tph)}</small>}{money(sh.tips)}</dd></div>
            {v.wage != null && <div><dt><MixKey token="--cat-wage" />Wage <span class={styles.note}>estimated</span></dt><dd class="num"><small>{dec1(v.hours)}h × {perHour(v.wageRate)}</small>{money(v.wage)}</dd></div>}
            {v.income.map(i => (
              <div key={i.id}><dt><MixKey token={`--cat-${i.category.toLowerCase()}`} />{i.category}{i.note && <span class={styles.note}>{i.note}</span>}</dt><dd class="num">{money(i.amount)}</dd></div>
            ))}
            {sh.other ? <div><dt><MixKey token="--cat-other" />Other <span class={styles.note}>earlier entry</span></dt><dd class="num">{money(sh.other)}</dd></div> : null}
            <div class={styles.total}><dt>Total</dt><dd class="num">{v.perHour != null && <small>{perHour(v.perHour)}</small>}{money(v.total)}</dd></div>
          </dl>
        </section>
      </div>
      {sh.notes && <p class={styles.notes}>{sh.notes}</p>}
    </div>
  );
}
