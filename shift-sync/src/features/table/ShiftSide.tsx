import { liveViews } from '../../data/store.ts';
import { scope } from '../../data/scope.ts';
import { today } from '../../lib/dates.ts';
import { DASH, dec1, dollars, money, perHour } from '../../lib/format.ts';
import { shiftStatus } from '../../lib/groups.ts';
import { priorLabel, priorViews } from '../../lib/scope.ts';
import { rankable, rateContext, summarize } from '../../lib/stats.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { pctChange } from '../../lib/trends.ts';
import { DayLine } from '../../parts/DayLine.tsx';
import { openSheet } from '../../router.ts';
import { MixKey } from '../../ui/MixBar.tsx';
import { RateFigure } from '../../ui/RateFigure.tsx';
import { CompareList } from '../../ui/kpi.tsx';
import { Icon } from '../../ui/Icon.tsx';

/** Overview's side card: the period before, the best and slowest rates, and the key for the Total bar. */
export function ShiftSide({ rows }: { rows: ShiftView[] }) {
  const now = summarize(rows);
  const prevList = priorViews(liveViews.value, scope.value, today());
  const prev = prevList ? summarize(prevList) : null;
  const label = priorLabel(scope.value, today());
  const heading = label ? `Against ${label}` : 'Against the period before';
  const comparable = prev != null && prev.shifts > 0;
  const ranked = rows.filter(rankable).sort((a, b) => (b.tph ?? 0) - (a.tph ?? 0));
  const picks = ranked.length >= 3 ? [ranked[0]!, ranked[1]!, ranked[ranked.length - 1]!] : [];
  const ctx = rateContext(rows.filter(v => v.tph != null));
  return (
    <>
      <div class="side-block">
        <h3 class="label">{heading}</h3>
        {comparable && prev ? (
          <CompareList rows={[
            { label: 'Tips', pct: pctChange(now.tips, prev.tips), from: dollars(prev.tips) },
            { label: 'Rate', pct: pctChange(now.tph, prev.tph), from: perHour(prev.tph) },
            { label: 'Total', pct: pctChange(now.total, prev.total), from: dollars(prev.total) },
            { label: 'Hours', pct: pctChange(now.hours, prev.hours), from: `${dec1(prev.hours)}h`, neutral: true }
          ]} />
        ) : <p class="muted side-note">Nothing to compare: no shifts {label ?? 'before'}.</p>}
      </div>
      {picks.length > 0 && (
        <div class="side-block">
          <h3 class="label">Best and slowest by Rate</h3>
          <div class="sl">
            {picks.map(v => (
              <button key={v.shift.id} type="button" class="sl-row" onClick={() => openSheet(v.shift.id)}>
                <DayLine v={v} variant="line" showMonth showYear />
                {v.tph != null ? <RateFigure tph={v.tph} ctx={ctx} compact /> : <span class="nil">{DASH}</span>}
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div class="side-block">
        <p class="muted side-note">Rate is tips over hours. Total adds wage and other income.</p>
        <div class="keyline" aria-label="Key for the bar under Total">
          <span><MixKey token="--cat-tips" />Tips</span>
          <span><MixKey token="--cat-wage" />Wage</span>
          <span><MixKey token="--cat-other" />Other</span>
        </div>
      </div>
    </>
  );
}

/** Pay's side card: all-in against the period before, and the three best-paid shifts. */
export function PaySide({ rows }: { rows: ShiftView[] }) {
  const now = summarize(rows);
  const prevList = priorViews(liveViews.value, scope.value, today());
  const prev = prevList ? summarize(prevList) : null;
  const label = priorLabel(scope.value, today());
  const best = rows.filter(v => shiftStatus(v) === 'done').slice().sort((a, b) => b.total - a.total).slice(0, 3);
  return (
    <>
      <div class="side-block">
        <h3 class="label">All in{label ? `, against ${label}` : ''}</h3>
        {prev && prev.shifts > 0 ? (
          <CompareList rows={[
            { label: 'Total', pct: pctChange(now.total, prev.total), from: dollars(prev.total) },
            { label: '$/hr all in', pct: pctChange(now.perHour, prev.perHour), from: money(prev.perHour) },
            { label: 'Per shift', pct: pctChange(now.perShift, prev.perShift), from: dollars(prev.perShift) }
          ]} />
        ) : <p class="muted side-note">Nothing to compare yet.</p>}
      </div>
      {best.length > 0 && (
        <div class="side-block">
          <h3 class="label">Best paid</h3>
          <div class="sl">
            {best.map(v => (
              <button key={v.shift.id} type="button" class="sl-row" onClick={() => openSheet(v.shift.id)}>
                <DayLine v={v} variant="line" showMonth />
                <span class="fig fig-semi">{dollars(v.total)}</span>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div class="side-block">
        <p class="muted side-note">Wage is estimated from hours and your hourly wage.</p>
        <a class="linkbtn" href="#/settings/wages">Hourly wage settings</a>
      </div>
    </>
  );
}
