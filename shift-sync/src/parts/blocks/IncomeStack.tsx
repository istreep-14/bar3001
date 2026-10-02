import { SOURCE_NAME as NAME, incomeByWeek, sourcesIn } from '../../lib/blocks.ts';
import { moneyWhole, shortDate } from '../../lib/format.ts';
import { niceScale } from '../../lib/periods.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { TableView, useTip } from '../../ui/charts.tsx';
import s from './blocks.module.css';


/* Income per week, one rounded column a week stacked by source: tips at the base, the estimated wage on it, then each
 * other source. Each piece is its own pill with a hairline of air between, so a thin source still reads. The week still
 * running is hatched over. The total sits above the column; hover or focus a week for its pieces. */
export function IncomeStack({ views, today, weeks = 8, height = 168 }: { views: ShiftView[]; today: string; weeks?: number; height?: number }) {
  const t = useTip();
  const data = incomeByWeek(views, today, weeks), srcs = sourcesIn(data);
  const max = Math.max(0, ...data.map(w => w.total));
  if (!max) return <p class={s.empty}>No money logged in the last {weeks} weeks.</p>;
  const scale = niceScale(max * 1.12);
  const avg = data.filter(w => !w.partial && w.total).reduce((a, w, _, all) => a + w.total / all.length, 0);
  return (
    <figure class={s.chart} ref={t.host} role="group" aria-label={`Income per week by source, last ${weeks} weeks`}>
      <div class={s.stack} style={{ '--h': height + 'px' }}>
        <div class={s.plot}>
          {avg > 0 && <i class={s.avgLine} style={{ bottom: (avg / scale.top) * 100 + '%' }} aria-hidden="true" />}
          {data.map(w => {
            const rows = srcs.filter(x => w.by[x]).map(x => ({ name: NAME[x], value: moneyWhole(w.by[x]!), cls: `k-src k-${x}` }));
            const h = (w.total / scale.top) * 100;
            return (
              <button type="button" key={w.key} class={s.sCol} data-partial={w.partial ? '' : undefined}
                aria-label={`Week of ${shortDate(w.key)}: ${moneyWhole(w.total)}. ${rows.map(r => `${r.name} ${r.value}`).join(', ')}`}
                {...t.bind(`Week of ${shortDate(w.key)}${w.partial ? ' (so far)' : ''} · ${moneyWhole(w.total)}`, rows)}>
                {w.total > 0 && <span class={s.sTotal} style={{ bottom: `calc(${h}% + 4px)` }}>{moneyWhole(w.total)}</span>}
                <span class={s.sBar} style={{ height: h + '%' }}>
                  {srcs.slice().reverse().map(x => w.by[x] ? <i key={x} data-src={x} style={{ flexGrow: w.by[x] }} /> : null)}
                </span>
                <span class={s.sX}>{shortDate(w.key).replace(/\s/, '\u00a0')}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ul class={s.key}>
        {srcs.map(x => <li key={x}><i data-src={x} />{NAME[x]} <b>{moneyWhole(data.reduce((a, w) => a + (w.by[x] ?? 0), 0))}</b></li>)}
        {avg > 0 && <li><i data-avg="" />Weekly average <b>{moneyWhole(avg)}</b></li>}
      </ul>
      <TableView headers={['Week', ...srcs.map(x => NAME[x]), 'Total']} rows={data.map(w => [shortDate(w.key), ...srcs.map(x => moneyWhole(w.by[x] ?? 0)), moneyWhole(w.total)])} />
      {t.node}
    </figure>
  );
}
