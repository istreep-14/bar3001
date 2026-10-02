import { METRICS, RANGES, isRate, series, valueOf } from '../../lib/home.ts';
import type { Grain, Metric, ShiftFilter } from '../../lib/home.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { ColumnChart } from '../../ui/charts.tsx';
import { useWidth } from '../../ui/useWidth.ts';
import { PillSwitch } from './Block.tsx';
import { fmtMetric } from './Recent.tsx';
import s from './PeriodChart.module.css';

/* Periods side by side: one figure per day, week or month over a range, through a filter (day or night, party or not),
 * with the average of the range as a dashed line. The controls are their own part (`ChartControls`) so any chart page
 * can offer the same choices; the page owns the state (and remembers it), the chart only draws it. */
export interface ChartChoice { metric: Metric; grain: Grain; count: number; filter: ShiftFilter }

const GRAIN_WORD: Record<Grain, [string, string]> = { day: ['day', 'Days'], week: ['week', 'Weeks'], month: ['month', 'Months'] };

export function ChartControls({ value, onChange, metrics = true }: { value: ChartChoice; onChange: (c: ChartChoice) => void; metrics?: boolean }) {
  const set = (p: Partial<ChartChoice>) => onChange({ ...value, ...p });
  return (
    <div class={s.controls}>
      {metrics && <PillSwitch label="Figure" value={value.metric} onChange={metric => set({ metric })} choices={METRICS.map(m => ({ value: m.id, label: m.label }))} />}
      <span class={s.group}>
        <PillSwitch label="Group by" value={value.grain} onChange={grain => set({ grain, count: RANGES[grain].start })}
          choices={(['day', 'week', 'month'] as Grain[]).map(g => ({ value: g, label: GRAIN_WORD[g][1] }))} />
        <PillSwitch label="How many" value={value.count} onChange={count => set({ count })}
          choices={RANGES[value.grain].choices.map(n => ({ value: n, label: String(n) }))} />
      </span>
      <span class={s.group}>
        <PillSwitch label="Shift type" value={value.filter.type} onChange={type => set({ filter: { ...value.filter, type } })}
          choices={[{ value: 'any', label: 'All' }, { value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]} />
        <PillSwitch label="Party" value={value.filter.party} onChange={party => set({ filter: { ...value.filter, party } })}
          choices={[{ value: 'any', label: 'Any' }, { value: 'yes', label: 'Party' }, { value: 'no', label: 'No party' }]} />
      </span>
    </div>
  );
}

export function PeriodChart({ views, today, choice, height = 180 }: { views: ShiftView[]; today: string; choice: ChartChoice; height?: number }) {
  const { metric, grain, count, filter } = choice;
  const pts = series(views, today, grain, count, filter);
  const name = METRICS.find(m => m.id === metric)!;
  const vals = pts.map(p => valueOf(p.s, metric));
  // the average leaves out the period still running, and for a rate any period with no hours
  const full = pts.filter((p, i) => !p.partial && (!isRate(metric) || vals[i] != null)).map(p => valueOf(p.s, metric) ?? 0);
  const avg = full.length ? full.reduce((a, b) => a + b, 0) / full.length : null;
  // a label every so often, counted back from the newest: about one per 3.5rem of the chart's own width
  const [width, ref] = useWidth<HTMLDivElement>();
  const every = Math.max(1, Math.ceil(pts.length / Math.max(4, Math.floor((width ?? 56) / 3.5))));
  const filtered = [filter.type !== 'any' && (filter.type === 'day' ? 'day shifts' : 'nights'), filter.party === 'yes' ? 'with a party' : filter.party === 'no' ? 'without a party' : null].filter(Boolean).join(' ');
  return (
    <div ref={ref} class={s.chart}>
    <ColumnChart title={`${name.label} per ${GRAIN_WORD[grain][0]}`}
      sub={[filtered && `Only ${filtered}`, avg != null && `average ${fmtMetric(metric, avg)}`, pts.at(-1)?.partial && `this ${GRAIN_WORD[grain][0]} so far`].filter(Boolean).join(' · ')}
      height={height} fmt={v => fmtMetric(metric, v)}
      guide={avg != null && avg > 0 ? { value: avg, label: 'avg' } : undefined}
      empty={filtered ? `No ${filtered} in this range.` : 'Nothing logged in this range yet.'}
      data={pts.map((p, i) => ({ xlabel: (pts.length - 1 - i) % every === 0 ? p.label : '', title: p.partial ? `${p.title} (so far)` : p.title, parts: [{ value: vals[i] ?? 0, cls: 'k-acc', name: name.label }] }))} />
    </div>
  );
}
