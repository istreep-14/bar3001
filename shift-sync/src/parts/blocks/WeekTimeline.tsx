import { weekAgenda } from '../../lib/blocks.ts';
import { clockShort, clockTight, dollars, perHourWhole, shortDate } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { openForm, openSheet, sheet } from '../../router.ts';
import s from './blocks.module.css';

/* A week on one clock: a row per day, the hours across, each shift a rounded block from its start to its end (a night
 * runs past midnight on the same row). Under your block, a hairline per bartender on with you, from their own start to
 * their own end, so a busy close shows as a thick bundle. The clock spans the week's earliest start to its latest end.
 * Today's row carries a "now" line; a day off is empty and tapping it adds a shift. */
export function WeekTimeline({ views, today, offset = 0, now }: { views: ShiftView[]; today: string; offset?: number; now?: number }) {
  const days = weekAgenda(views, today, offset);
  const span = (v: ShiftView | { start: number | null; end: number | null }) => {
    const a = 'shift' in v ? v.shift.start : v.start, b = 'shift' in v ? v.shift.end : v.end;
    if (a == null) return null;
    const e = b == null ? a + 360 : b <= a ? b + 1440 : b;   // no end yet: draw a typical six hours, dashed
    return { a, e };
  };
  let lo = 18 * 60, hi = 26 * 60;
  for (const d of days) for (const v of d.views) {
    const sp = span(v); if (!sp) continue;
    lo = Math.min(lo, sp.a); hi = Math.max(hi, sp.e);
    for (const c of v.crew) { const cs = span(c); if (cs) { lo = Math.min(lo, cs.a); hi = Math.max(hi, cs.e); } }
  }
  lo = Math.floor(lo / 120) * 120; hi = Math.ceil(hi / 120) * 120;
  const pct = (m: number) => ((m - lo) / (hi - lo)) * 100;
  const ticks: number[] = []; for (let t = lo; t <= hi; t += 120) ticks.push(t);
  const nowMin = now ?? new Date().getHours() * 60 + new Date().getMinutes();
  return (
    <div class={s.tl} role="group" aria-label={`Shifts the week of ${shortDate(days[0]!.date)}, on one clock`}>
      <div class={s.tlAxis} aria-hidden="true">
        <span />
        <div class={s.tlScale}>{ticks.map(t => <span key={t} style={{ left: pct(t) + '%' }}>{clockTight(t % 1440)}</span>)}</div>
      </div>
      {days.map(d => {
        const wd = new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
        return (
          <div key={d.date} class={s.tlRow} data-when={d.when}>
            <span class={s.tlDay}><b>{wd}</b> {+d.date.slice(8)}</span>
            <div class={s.tlTrack}>
              {ticks.map(t => <i key={t} class={s.tlGrid} style={{ left: pct(t) + '%' }} aria-hidden="true" />)}
              {d.views.length === 0 && (
                <button type="button" class={s.tlEmpty} aria-label={`${wd} ${shortDate(d.date)}: off. Add a shift`} onClick={() => openForm('new', d.date)} />
              )}
              {d.views.map(v => {
                const sp = span(v); if (!sp) return null;
                const st = shiftStatus(v), tone = d.when === 'today' ? 'inverse' : st;
                const label = `${clockShort(v.shift.start)}${v.shift.end != null ? '–' + clockShort(v.shift.end) : ''}`;
                return (
                  <div key={v.shift.id} class={s.tlShift} style={{ left: pct(sp.a) + '%', width: pct(sp.e) - pct(sp.a) + '%' }}>
                    <button type="button" class={s.tlBlock} data-tone={tone} aria-pressed={sheet.value === v.shift.id} onClick={() => openSheet(v.shift.id)}
                      aria-label={`${wd} ${shortDate(d.date)}, ${label}${st === 'done' ? `, ${dollars(v.shift.tips)} tips` : ''}. Open`}>
                      <span class={s.tlTime}>{label}</span>
                      {st === 'done' && <span class={s.tlMoney}>{dollars(v.shift.tips)} <small>{perHourWhole(v.tph)}</small></span>}
                      {st === 'worked' && <span class={s.tlMoney}>tips?</span>}
                    </button>
                    {v.crew.length > 0 && (
                      <span class={s.tlCrew} aria-hidden="true">
                        {v.crew.slice(0, 6).map(c => {
                          const cs = span(c); if (!cs) return null;
                          const w = sp.e - sp.a || 1;
                          return <i key={c.id} style={{ left: ((cs.a - sp.a) / w) * 100 + '%', width: ((cs.e - cs.a) / w) * 100 + '%' }} />;
                        })}
                      </span>
                    )}
                  </div>
                );
              })}
              {d.when === 'today' && (nowMin >= lo % 1440 || nowMin + 1440 <= hi) && (() => {
                const m = nowMin < lo ? nowMin + 1440 : nowMin;
                return m <= hi ? <i class={s.tlNow} style={{ left: pct(m) + '%' }} aria-hidden="true" /> : null;
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
