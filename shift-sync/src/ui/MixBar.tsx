import { moneyWhole } from '../lib/format.ts';
import type { IncomePart } from '../lib/groups.ts';

/** What a total is made of, as one stacked bar. Only where a shift is opened (a card, the drawer, the form), never
 *  in a table row. Each part is also named with its amount in the list beside it, so colour never carries it alone. */
export function MixBar({ parts, labels = true }: { parts: IncomePart[]; labels?: boolean }) {
  const total = parts.reduce((t, p) => t + p.amount, 0);
  if (!total) return null;
  return (
    <div class="mixbar" role="img" aria-label={parts.map(p => `${p.label} ${moneyWhole(p.amount)}`).join(', ')}>
      {parts.map(p => {
        const pct = (p.amount / total) * 100;
        return (
          <span key={p.key} class="mixbar-part" data-part={p.key} style={{ width: `${pct}%`, background: `var(${p.token})` }} title={`${p.label} ${moneyWhole(p.amount)}`}>
            {labels && pct >= 14 && <span class="mixbar-label">{p.label} {moneyWhole(p.amount)}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** The key square a stacked list row uses to tie its line to a bar part. */
export const MixKey = ({ token }: { token: string }) => <span class="mixkey" style={{ background: `var(${token})` }} aria-hidden="true" />;
