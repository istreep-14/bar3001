import { money, perHour } from '../lib/format.ts';
import { lean, scaleColor, standing } from '../lib/meters.ts';
import type { RateContext } from '../lib/stats.ts';
import { RankBar } from './Meters.tsx';
import styles from './RateFigure.module.css';

/** A shift's tips per hour, judged the one way the app judges how a shift went: where its rate stands among the shifts
 *  listed (`ctx`, from lib/stats `rateContext`). The figure sits in a pill tinted off one continuous scale, red at the
 *  bottom through plain ink to green at the top, and a slim bar stood on end fills as far as it ranks. Hovering (or a
 *  screen reader) says it in words. The Log's rows use it under their Rate head; `card` is the phone's card, where
 *  there is no head, so the figure carries its '/hr'.
 *
 *  `compact` is the data sheets' form (Shifts, Weeks, Staffing, side panels): a 1.5rem pill that stays
 *  quiet, a faint tint and a hairline outline instead of a filled block, with the tone a third of the way along the
 *  scale and a 3px rank bar. `of` names what it is ranked among in the tooltip ('shifts', 'weeks', 'months'). */
export function RateFigure({ tph, ctx, card, compact, of = 'shifts' }: { tph: number; ctx: RateContext; card?: boolean; compact?: boolean; of?: string }) {
  const at = standing(ctx.rates, tph);
  const l = at == null ? 0 : lean(at);
  const diff = ctx.avg == null ? null : tph - ctx.avg;
  const says = at == null || diff == null || ctx.avg == null ? undefined
    : `Better than ${Math.round(at * 100)}% of the ${of} here\n${Math.abs(diff) < 0.005 ? 'Right on' : `${perHour(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'}`} your average ${perHour(ctx.avg)}`;
  const tone = compact ? scaleColor(l, 'var(--ink-2)', 35) : scaleColor(l, 'var(--ink-2)', 75);
  const bar = compact ? scaleColor(l, 'var(--ink-4)', 60) : scaleColor(l, 'var(--ink-4)', 80);
  return (
    <span class={`${styles.rate} ${says ? 'tip' : ''}`} data-card={card ? '' : undefined} data-compact={compact ? '' : undefined} data-tip={says} style={{ '--tone': tone }}>
      {compact && <span class="sr-only">Rate </span>}
      <span class={`num ${styles.pill}`}>{card ? perHour(tph) : money(tph)}</span>
      {at != null && <RankBar up at={at} color={bar} />}
      {says && <span class="sr-only">{'. ' + says.replace('\n', '. ')}</span>}
    </span>
  );
}
