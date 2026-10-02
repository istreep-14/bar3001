import { dollars, money } from '../lib/format.ts';
import { StackBar } from './Meters.tsx';

export interface TotalPart { key: string; label: string; amount: number; color: string; estimated?: boolean }

/** A whole-dollar total with a 3px stack bar exactly as wide as the figure. The tooltip names every colour
 *  (cents stay in the tooltip; the figure itself is whole dollars). `lead` is the row's strongest number. */
export function TotalFigure({ amount, parts, lead, shares }: { amount: number; parts: TotalPart[]; lead?: boolean; shares?: boolean }) {
  const shown = parts.filter(p => p.amount > 0);
  const sum = shown.reduce((t, p) => t + p.amount, 0);
  const tip = shown.map(p => {
    const fig = p.amount % 1 ? money(p.amount) : dollars(p.amount);
    const est = p.estimated ? (shares ? ' est.' : ' (estimated)') : '';
    const share = shares && sum ? ` (${Math.round((p.amount / sum) * 100)}%)` : '';
    return `${p.label} ${fig}${est}${share}`;
  }).join('\n');
  return (
    <span class={`tot${tip ? ' tip' : ''}`} data-tip={tip || undefined}>
      <span class={lead ? 'fig fig-key' : 'fig fig-q'}>{dollars(amount)}</span>
      {sum > 0 && <StackBar parts={shown.map(p => ({ key: p.key, amount: p.amount, color: p.color }))} />}
      {tip && <span class="sr-only">{tip.replaceAll('\n', '. ')}</span>}
    </span>
  );
}
