import { METRICS, lastDays, pace, series, soFar, valueOf, versusSimilar, weekPace } from '../../lib/home.ts';
import type { Metric, SoFar } from '../../lib/home.ts';
import { dollars, hours, moneyWhole, perHourWhole, shortDate, weekdayShort } from '../../lib/format.ts';
import { isPending } from '../../lib/groups.ts';
import { byRecent } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openSheet, sheet } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import { DeltaPill, Spark } from '../../ui/kpi.tsx';
import s from './Recent.module.css';

/* What recent shifts say, for Home:
 *   Figures        the five figures over the last 7 days, each with its change against the 7 days before and a spark of
 *                  the last 8 weeks: take-home, tips, hours, tips per hour, take-home per hour
 *   SoFarCard      this week, month or year so far against the same point of the one before, then what the last 8
 *                  weeks make a month and a year at that pace
 *   RecentShifts   the latest finished shifts, each against shifts like it (day or night, party or not, the weekday when
 *                  there are enough) on tips per hour */

export const fmtMetric = (m: Metric, v: number | null): string =>
  v == null ? '—' : m === 'hours' ? hours(v) : m === 'tph' || m === 'perHour' ? perHourWhole(v) : dollars(v);

export function Figures({ views, today, days = 7 }: { views: ShiftView[]; today: string; days?: number }) {
  const r = lastDays(views, today, days), weeks = series(views, today, 'week', 8);
  return (
    <dl class={s.figs} aria-label={`The last ${days} days against the ${days} before`}>
      {METRICS.map(m => (
        <div key={m.id} class={s.fig} data-lead={m.id === 'total' ? '' : undefined} title={m.long}>
          <dt>{m.label}</dt>
          <dd class={s.fv}>{fmtMetric(m.id, valueOf(r.now, m.id))}</dd>
          <dd class={s.fd}>
            {r.delta[m.id] == null ? <span class={s.nil}>no change to show</span> : <DeltaPill pct={r.delta[m.id]} neutral={m.id === 'hours'} />}
            <span class={s.from}>from {fmtMetric(m.id, valueOf(r.before, m.id))}</span>
          </dd>
          <dd class={s.fs} aria-hidden="true"><Spark values={weeks.map(w => (w.s.shifts ? valueOf(w.s, m.id) : null))} w={88} h={22} /></dd>
        </div>
      ))}
    </dl>
  );
}

const whenOf = (v: ShiftView) => `${weekdayShort(v.shift.date)} ${shortDate(v.shift.date)}`;

export function RecentShifts({ views, take = 6, metric = 'tph', selected, onSelect }: {
  views: ShiftView[]; take?: number; metric?: Metric;
  /** When set, a row selects the shift. Clicking the selected row opens it. */
  selected?: string; onSelect?: (v: ShiftView) => void;
}) {
  const done = views.filter(v => !isPending(v)).sort(byRecent).slice(0, take);
  if (!done.length) return <p class={s.empty}>Finished shifts show here with how they did against shifts like them.</p>;
  return (
    <ol class={s.list}>
      {done.map(v => {
        const cmp = versusSimilar(views, v, metric);
        return (
          <li key={v.shift.id}>
            <button type="button" class={s.row} aria-pressed={onSelect ? selected === v.shift.id : sheet.value === v.shift.id}
              onClick={() => { if (!onSelect || selected === v.shift.id) openSheet(v.shift.id); else onSelect(v); }}
              aria-label={`${whenOf(v)}: ${dollars(v.shift.tips)} tips, ${perHourWhole(v.tph)}${cmp?.pct != null ? `, ${Math.round(Math.abs(cmp.pct))}% ${cmp.pct >= 0 ? 'above' : 'below'} ${cmp.like.label}` : ''}. ${onSelect && selected !== v.shift.id ? 'Select' : 'Open'}`}>
              <span class={s.when}>
                <span class={s.type} data-type={v.shift.shift_type ?? undefined}><Icon name={v.shift.shift_type === 'day' ? 'sun' : 'moon'} /></span>
                <span class={s.date}><b>{whenOf(v)}</b>{v.shift.party && <small class={s.party}>Party</small>}</span>
              </span>
              <span class={s.num}><b>{moneyWhole(v.shift.tips ?? 0)}</b><small>{hours(v.hours)}</small></span>
              <span class={s.num}><b>{fmtMetric('tph', v.tph)}</b><small>{fmtMetric('perHour', v.perHour)} all in</small></span>
              <span class={s.vs}>
                {cmp?.pct != null ? <><DeltaPill pct={cmp.pct} /><small>vs {cmp.like.label}</small></> : <small class={s.nil}>too few like it yet</small>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const SO_FAR_BEFORE: Record<SoFar, string> = { week: 'the same days last week', month: 'the same point last month', year: 'the same point last year' };

export function SoFarCard({ views, today, unit }: { views: ShiftView[]; today: string; unit: SoFar }) {
  const c = soFar(views, today, unit), p = pace(views, today), wk = weekPace(views, today);
  return (
    <div class={s.sofar}>
      <div class={s.big}>
        <span class={s.bigV}>{dollars(c.now.total)}</span>
        <span class={s.bigN}>{c.delta.total != null && <DeltaPill pct={c.delta.total} />}<span>take-home · vs {dollars(c.before.total)} at {SO_FAR_BEFORE[unit]}</span></span>
      </div>
      <dl class={s.rows}>
        {METRICS.filter(m => m.id !== 'total').map(m => (
          <div key={m.id}>
            <dt>{m.label}</dt>
            <dd><b>{fmtMetric(m.id, valueOf(c.now, m.id))}</b>{c.delta[m.id] != null ? <DeltaPill pct={c.delta[m.id]} neutral={m.id === 'hours'} /> : <span class={s.nil}>—</span>}</dd>
          </div>
        ))}
      </dl>
      {unit === 'week' && wk.booked > 0 && (
        <p class={s.pace}><span>With {wk.booked} more booked</span><b>~{dollars(wk.expected)}</b><small>{wk.unknown ? `${wk.unknown} too new to guess` : 'this week, if they go like shifts like them'}</small></p>
      )}
      <p class={s.pace} title={`The last ${p.weeks} full weeks averaged ${dollars(p.perWeek.total)} and ${hours(p.perWeek.hours)} a week`}>
        <span>At your {p.weeks}-week pace</span><b>≈ {dollars(p.month)}<small>/mo</small> · {dollars(p.year)}<small>/yr</small></b>
        <small>{dollars(p.perWeek.total)} and {hours(p.perWeek.hours)} a week</small>
      </p>
    </div>
  );
}
