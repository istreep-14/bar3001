import { hoursWorked } from '../core/core.generated.js';
import { personById } from '../data/store.ts';
import { DASH, clockPlain, dec1, hours, money } from '../lib/format.ts';
import { incomeParts } from '../lib/groups.ts';
import type { ShiftView } from '../lib/stats.ts';
import { MixBar, MixKey } from '../ui/MixBar.tsx';
import styles from './ShiftDetails.module.css';

/* One shift, read-only, as stacked lists: Time, Crew, Money (label left, detail in the middle, amount right, a bold
 * total last), with the income mix bar over them. The same block is the drawer's body and an opened Log row, so the
 * two can never drift apart. `layout` only changes the arrangement: 'stack' in the drawer, 'columns' in a wide card. */
export function ShiftDetails({ v, layout }: { v: ShiftView; layout: 'stack' | 'columns' }) {
  const sh = v.shift;
  const parts = incomeParts(v);
  return (
    <div class={styles.details} data-layout={layout}>
      {parts.length > 0 && <MixBar parts={parts} labels={layout === 'columns'} />}
      <div class={styles.lists}>
        <section class={styles.list} aria-label="Time">
          <h4 class={styles.cap}>Time</h4>
          <dl class={styles.kv}>
            <div><dt>Start</dt><dd class="num">{clockPlain(sh.start) || DASH}</dd></div>
            <div><dt>End</dt><dd class="num">{clockPlain(sh.end) || DASH}</dd></div>
            <div><dt>Hours</dt><dd class="num">{hours(v.hours)}</dd></div>
          </dl>
        </section>
        <section class={styles.list} aria-label="Crew">
          <h4 class={styles.cap}>Crew</h4>
          {v.crew.length === 0 ? <p class={styles.empty}>No bartenders logged. Edit the shift to add who worked it.</p> : (
            <dl class={styles.kv}>
              {v.crew.map(c => {
                const p = personById(c.staff_id), h = hoursWorked(c.start, c.end);
                return (
                  <div key={c.id}>
                    <dt>{p?.name ?? c.name ?? 'Unknown'}{p?.is_user && <span class={styles.note}>you</span>}</dt>
                    <dd class="num"><small>{clockPlain(c.start) || DASH} – {clockPlain(c.end) || DASH}</small>{h == null ? DASH : `${dec1(h)}h`}</dd>
                  </div>
                );
              })}
              <div class={styles.total}><dt>{v.crewCount} {v.crewCount === 1 ? 'bartender' : 'bartenders'}</dt><dd class="num">{dec1(v.crewHours)}h</dd></div>
            </dl>
          )}
        </section>
        <section class={styles.list} aria-label="Money">
          <h4 class={styles.cap}>Money</h4>
          <dl class={styles.kv}>
            {/* tips/hr here is this record's own arithmetic, not a ranking metric (Rate stays tips-only). */}
            <div><dt><MixKey token="--cat-tips" />Tips</dt><dd class="num">{v.tph != null && <small>{money(v.tph)}/hr</small>}{money(sh.tips)}</dd></div>
            {v.wage != null && <div><dt><MixKey token="--cat-wage" />Wage <span class={styles.note}>estimated</span></dt><dd class="num"><small>{dec1(v.hours)}h × ${v.wageRate}/hr</small>{money(v.wage)}</dd></div>}
            {v.income.map(i => (
              <div key={i.id}><dt><MixKey token={`--cat-${i.category.toLowerCase()}`} />{i.category}{i.note && <span class={styles.note}>{i.note}</span>}</dt><dd class="num">{money(i.amount)}</dd></div>
            ))}
            {sh.other ? <div><dt><MixKey token="--cat-other" />Other <span class={styles.note}>earlier entry</span></dt><dd class="num">{money(sh.other)}</dd></div> : null}
            <div class={styles.total}><dt>Total</dt><dd class="num">{v.perHour != null && <small>{money(v.perHour)}/hr</small>}{money(v.total)}</dd></div>
          </dl>
        </section>
      </div>
      {sh.notes && <p class={styles.notes}>{sh.notes}</p>}
    </div>
  );
}
