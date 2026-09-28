import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { niceScale } from '../lib/periods.ts';
import type { Histo } from '../lib/trends.ts';
import { DeltaPill, Spark } from './kpi.tsx';

/* The pieces the Overview and Calendar draw numbers with: stat tiles, facts, column / dot-line / bar charts, the shift
 * ribbon. Charts are HTML laid out in percentages, so they reflow with their card and need no resize code.
 * Rules every chart keeps: one measure per axis (two measures are two charts), a legend where colour carries identity,
 * the value at a bar's tip, a tooltip on hover and on focus, and a table view so nothing depends on seeing colour. */

/* ── stat tiles: a label, the figure, and what it is measured against. `lead` makes one the larger first read ── */
export interface Tile { label: string; value: ComponentChildren; sub?: ComponentChildren; hint?: string; lead?: boolean;
  /** A change against the span before, as a pill beside the figure's note, and the last few periods as a spark. */
  pct?: number | null; vs?: string; neutral?: boolean; spark?: (number | null)[] }
export function Tiles({ items, label }: { items: Tile[]; label?: string }) {
  return (
    <dl class="tiles" aria-label={label}>
      {items.map(t => (
        <div class={t.lead ? 'tile lead' : 'tile'} key={t.label} title={t.hint}>
          <dt>{t.label}</dt>
          <dd class="tv"><span>{t.value}</span>{t.spark && <Spark values={t.spark} w={t.lead ? 84 : 60} h={t.lead ? 30 : 24} />}</dd>
          {(t.pct !== undefined || t.sub) && <div class="subrow">{t.pct !== undefined && (t.pct == null ? <span>nothing to compare yet</span> : <><DeltaPill pct={t.pct} neutral={t.neutral} />{t.vs && <span>vs {t.vs}</span>}</>)}{t.sub}</div>}
        </div>
      ))}
    </dl>
  );
}

/* ── facts: a quiet line of small figures, for pages where the input is the point. A tone adds an arrow, so
 *    direction never depends on colour alone. ── */
export interface Fact { label: string; value: string; note?: string; tone?: 'up' | 'down'; hint?: string }
export function Facts({ items }: { items: (Fact | null | false)[] }) {
  const list = items.filter((f): f is Fact => !!f);
  return (
    <ul class="facts">
      {list.map(f => (
        <li key={f.label} class={'fact' + (f.tone ? ' ' + f.tone : '')} title={f.hint}>
          <span class="fk">{f.label}</span> <b>{f.value}</b>
          {f.note && <span class="fn"> {f.tone === 'up' ? '▲ ' : f.tone === 'down' ? '▼ ' : ''}{f.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ── tooltip: one per chart, values first, then what they are ── */
interface TipRow { name: string; value: string; cls?: string }
interface TipState { left: number; top: number; title: string; rows: TipRow[] }
function useTip() {
  const host = useRef<HTMLElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const bind = (title: string, rows: TipRow[]) => ({
    onPointerEnter: (e: Event) => show(e.currentTarget as HTMLElement, title, rows),
    onFocus: (e: Event) => show(e.currentTarget as HTMLElement, title, rows),
    onPointerLeave: () => setTip(null),
    onBlur: () => setTip(null)
  });
  function show(anchor: HTMLElement, title: string, rows: TipRow[]) {
    const box = host.current?.getBoundingClientRect(), at = anchor.getBoundingClientRect();
    if (!box) return;
    const center = at.left + at.width / 2 - box.left;
    setTip({ left: Math.max(96, Math.min(box.width - 96, center)), top: at.top - box.top, title, rows });
  }
  const node = tip && (
    <div class="viztip" role="tooltip" style={{ left: tip.left + 'px', top: tip.top + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }}>
      <div class="tt-title">{tip.title}</div>
      {tip.rows.map(r => <div class="tt-row" key={r.name + r.value}><i class={'tt-key ' + (r.cls ?? '')} /><b>{r.value}</b><span>{r.name}</span></div>)}
    </div>
  );
  return { host, bind, node };
}

/** A collapsed table of exactly what the chart shows, for anyone who can't or won't read the picture. */
export function TableView({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details class="viz-table">
      <summary>View as table</summary>
      <table>
        <thead><tr>{headers.map((t, i) => <th key={t} class={i ? 'num' : ''}>{t}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} class={j ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

const Cap = ({ title, sub }: { title?: string; sub?: string }) => (title ? <figcaption class="viz-cap"><h4>{title}</h4>{sub && <span class="muted">{sub}</span>}</figcaption> : null);
const EmptyFigure = ({ title, text }: { title?: string; text: string }) => <figure class="viz"><Cap title={title} /><div class="viz-empty muted">{text}</div></figure>;
export const Legend = ({ items }: { items: { cls: string; label: string }[] }) => (
  <ul class="legend">{items.map(i => <li key={i.label}><i class={'key ' + i.cls} />{i.label}</li>)}</ul>
);

/* ── columns: one bar per period; a bar may be stacked from parts ── */
export interface ColDatum { xlabel: string; title: string; parts: { value: number; cls: string; name: string }[] }
export function ColumnChart({ title, sub, data, fmt, height = 168, empty = 'Nothing logged in this range yet.', legend, guide }: {
  title: string; sub?: string; data: ColDatum[]; fmt: (v: number) => string; height?: number; empty?: string; legend?: { cls: string; label: string }[];
  /** A dashed reference line (the 40-hour week). */
  guide?: { value: number; label: string };
}) {
  const t = useTip();
  const totals = data.map(d => d.parts.reduce((a, p) => a + p.value, 0));
  const max = Math.max(0, ...totals);
  if (!data.length || max === 0) return <EmptyFigure title={title} text={empty} />;
  const scale = niceScale(Math.max(max, guide?.value ?? 0) * 1.08), peak = totals.indexOf(max), stacked = data[0]!.parts.length > 1;   // headroom, so the value label above the tallest bar never meets the caption
  return (
    <figure class="viz" role="group" aria-label={title} ref={t.host}>
      <Cap title={title} sub={sub} />
      <div class="plot" style={{ '--plot-h': height + 'px' }}>
        <div class="yaxis" aria-hidden="true">{scale.ticks.map(v => <span class="yt" key={v} style={{ bottom: (v / scale.top) * 100 + '%' }}>{fmt(v)}</span>)}</div>
        <div class="area">
          {scale.ticks.map(v => <div class="gl" key={v} style={{ bottom: (v / scale.top) * 100 + '%' }} />)}
          {guide && <div class="refline" style={{ bottom: (guide.value / scale.top) * 100 + '%' }}><span>{guide.label}</span></div>}
          <div class="cols">
            {data.map((d, i) => {
              const rows = d.parts.filter(p => p.value > 0).map(p => ({ name: p.name, value: fmt(p.value), cls: p.cls }));
              if (stacked) rows.push({ name: 'Total', value: fmt(totals[i]!), cls: '' });
              return (
                <button type="button" class="col" key={d.title} aria-label={`${d.title}: ${rows.map(r => `${r.name} ${r.value}`).join(', ')}`} {...t.bind(d.title, rows)}>
                  <div class="bar" style={{ height: (totals[i]! / scale.top) * 100 + '%' }}>
                    {d.parts.filter(p => p.value > 0).map(p => <i class={'part ' + p.cls} key={p.name} style={{ flexGrow: p.value }} />)}
                    {(i === peak || i === data.length - 1) && totals[i]! > 0 && <span class="vl">{fmt(totals[i]!)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div class="xaxis" aria-hidden="true">{data.map(d => <span class="xl" key={d.title}>{d.xlabel}</span>)}</div>
      </div>
      {legend && <Legend items={legend} />}
      <TableView headers={['Period', ...(stacked ? data[0]!.parts.map(p => p.name) : ['Value']), ...(stacked ? ['Total'] : [])]}
        rows={data.map((d, i) => [d.title, ...d.parts.map(p => fmt(p.value)), ...(stacked ? [fmt(totals[i]!)] : [])])} />
      {t.node}
    </figure>
  );
}

/* ── dots on a line: one dot per shift, coloured by its type; `avg` draws a reference line ── */
export interface DotDatum { xlabel: string; title: string; y: number; cls: string; rows: TipRow[] }
export function DotLine({ title, sub, data, fmt, valueLabel = 'Value', avg = null, height = 168, empty = 'Log a few shifts to see them here.', legend }: {
  title: string; sub?: string; data: DotDatum[]; fmt: (v: number) => string; valueLabel?: string; avg?: number | null; height?: number; empty?: string; legend?: { cls: string; label: string }[];
}) {
  const t = useTip();
  if (data.length < 2) return <EmptyFigure title={title} text={empty} />;
  const scale = niceScale(Math.max(...data.map(d => d.y), avg ?? 0));
  const pos = (i: number) => 3 + (i / (data.length - 1)) * 94, yPct = (v: number) => (v / scale.top) * 100;
  const every = Math.max(1, Math.ceil(data.length / 5)), last = data.length - 1;
  const xl = (d: DotDatum, i: number) => (i % every === 0 || (i === last && last % every >= Math.ceil(every / 2)) ? d.xlabel : '');
  return (
    <figure class="viz" role="group" aria-label={title} ref={t.host}>
      <Cap title={title} sub={sub} />
      <div class="plot" style={{ '--plot-h': height + 'px' }}>
        <div class="yaxis" aria-hidden="true">{scale.ticks.map(v => <span class="yt" key={v} style={{ bottom: yPct(v) + '%' }}>{fmt(v)}</span>)}</div>
        <div class="area">
          {scale.ticks.map(v => <div class="gl" key={v} style={{ bottom: yPct(v) + '%' }} />)}
          {avg != null && <div class="avgline" style={{ bottom: yPct(avg) + '%' }}><span>avg {fmt(avg)}</span></div>}
          <svg class="line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={data.map((d, i) => `${pos(i).toFixed(2)},${(100 - yPct(d.y)).toFixed(2)}`).join(' ')} vector-effect="non-scaling-stroke" />
          </svg>
          {data.map((d, i) => <button type="button" key={i} class={'pt ' + d.cls} aria-label={`${d.title}: ${fmt(d.y)}`} style={{ left: pos(i) + '%', bottom: yPct(d.y) + '%' }} {...t.bind(d.title, d.rows)} />)}
        </div>
        <div class="xaxis xaxis-free" aria-hidden="true">{data.map((d, i) => <span class="xl" key={i} style={{ left: pos(i) + '%' }}>{xl(d, i)}</span>)}</div>
      </div>
      {legend && <Legend items={legend} />}
      <TableView headers={['Shift', valueLabel]} rows={data.map(d => [d.title, fmt(d.y)])} />
      {t.node}
    </figure>
  );
}

/* ── horizontal bars: a handful of categories, the value at the tip ── */
export interface HBarDatum { label: string; note?: string; value: number | null; cls?: string; title?: string }
export function HBars({ title, sub, data, fmt, empty = 'Nothing to compare yet.' }: { title: string; sub?: string; data: HBarDatum[]; fmt: (v: number) => string; empty?: string }) {
  const shown = data.filter(d => d.value != null);
  if (!shown.length) return <EmptyFigure title={title} text={empty} />;
  const max = Math.max(...shown.map(d => d.value!)) || 1;
  return (
    <figure class="viz" role="group" aria-label={title}>
      <Cap title={title} sub={sub} />
      <ul class="hbars">
        {data.map(d => (
          <li class="hrow" key={d.label} title={d.title}>
            <span class="hl">{d.label}{d.note && <span class="muted"> {d.note}</span>}</span>
            <span class="track">{d.value != null && <i class={'hfill ' + (d.cls ?? '')} style={{ width: Math.max(1.5, (d.value / max) * 100) + '%' }} />}</span>
            <b class="hv">{d.value == null ? '—' : fmt(d.value)}</b>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ── the shift ribbon: shifts laid along the clock, one lane each (you, then each bartender) ── */
/** seg-work: this shift · seg-crew: a bartender on it · seg-past: an earlier shift drawn for reference (the form's Time page). */
export interface Lane { name: string; start: number | null; end: number | null; cls: 'seg-work' | 'seg-crew' | 'seg-past' }
const hourLabel = (m: number) => { const h = Math.floor(m / 60) % 24; return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };
const clockText = (m: number) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
export function Ribbon({ lanes, slim = true }: { lanes: Lane[]; slim?: boolean }) {
  const timed = lanes.filter(l => l.start != null && l.end != null).map(l => ({ ...l, s: l.start!, e: l.end! <= l.start! ? l.end! + 1440 : l.end! }));
  if (!timed.length) return <figure class={'viz ribbon' + (slim ? ' slim' : '')}><div class="viz-empty muted">Enter the start and end times to see the shift laid out.</div></figure>;
  const origin = Math.floor(Math.min(...timed.map(l => l.s)) / 60) * 60;
  const total = Math.max(240, Math.ceil((Math.max(...timed.map(l => l.e)) - origin) / 60) * 60);
  const step = total <= 480 ? 60 : total <= 840 ? 120 : 180;
  const ticks: number[] = [];
  for (let m = 0; m <= total; m += step) ticks.push(m);
  const at = (m: number) => ((m - origin) / total) * 100;
  return (
    <figure class={'viz ribbon' + (slim ? ' slim' : '')}>
      <div class="ribbon-body" role="img" aria-label={timed.map(l => `${l.name} ${clockText(l.s)} to ${clockText(l.e)}`).join('; ')}>
        <div class="lanes">
          <div class="vgrid" aria-hidden="true">{ticks.map(m => <i key={m} style={{ left: (m / total) * 100 + '%' }} />)}</div>
          {timed.map(l => (
            <div class="lane" key={l.name}>
              <span class="lname">{l.name}</span>
              <div class="ltrack"><i class={l.cls} title={`${l.name}: ${clockText(l.s)} to ${clockText(l.e)}`} style={{ left: at(l.s) + '%', width: ((l.e - l.s) / total) * 100 + '%' }} /></div>
            </div>
          ))}
          <div class="lane ticks"><span class="lname" /><div class="ltrack">{ticks.map(m => <span class="tick" key={m} style={{ left: (m / total) * 100 + '%' }}>{hourLabel(origin + m)}</span>)}</div></div>
        </div>
      </div>
    </figure>
  );
}

/* ── a trend: bars on the left axis (tips a week) with a line on its own right axis (tips per hour), plus the smoothed
 *    line that carries the trend. Two measures on one chart is the one exception to "one measure per axis": each has
 *    its own labelled axis and its own key, and the tooltip and table give both. ── */
export interface ComboDatum { xlabel: string; title: string; bar: number; line: number | null; smooth: number | null; partial?: boolean; rows: TipRow[] }
export function ComboChart({ title, sub, data, fmtBar, fmtLine, barLabel, lineLabel, smoothLabel, height = 200, empty = 'Nothing logged in this range yet.' }: {
  title: string; sub?: string; data: ComboDatum[]; fmtBar: (v: number) => string; fmtLine: (v: number) => string;
  barLabel: string; lineLabel: string; smoothLabel: string; height?: number; empty?: string;
}) {
  const t = useTip();
  const maxBar = Math.max(0, ...data.map(d => d.bar)), maxLine = Math.max(0, ...data.map(d => Math.max(d.line ?? 0, d.smooth ?? 0)));
  if (data.length < 2 || maxBar === 0) return <EmptyFigure title={title} text={empty} />;
  const left = niceScale(maxBar * 1.08), right = niceScale(maxLine * 1.08 || 1);
  const x = (i: number) => ((i + 0.5) / data.length) * 100, yl = (v: number) => 100 - (v / right.top) * 100;
  // the smoothed line, broken wherever a week has no rate
  let path = '', pen = false;
  data.forEach((d, i) => { if (d.smooth == null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${yl(d.smooth).toFixed(2)} `; pen = true; });
  const every = Math.max(1, Math.ceil(data.length / 10));
  return (
    <figure class="viz" role="group" aria-label={title} ref={t.host}>
      <Cap title={title} sub={sub} />
      <div class="plot dual" style={{ '--plot-h': height + 'px' }}>
        <div class="yaxis" aria-hidden="true">{left.ticks.map(v => <span class="yt" key={v} style={{ bottom: (v / left.top) * 100 + '%' }}>{fmtBar(v)}</span>)}</div>
        <div class="area">
          {left.ticks.map(v => <div class="gl" key={v} style={{ bottom: (v / left.top) * 100 + '%' }} />)}
          <div class="cols">
            {data.map((d, i) => (
              <button type="button" class={'col' + (d.partial ? ' partial' : '')} key={d.title} aria-label={`${d.title}: ${d.rows.map(r => `${r.name} ${r.value}`).join(', ')}`} {...t.bind(d.title, d.rows)}>
                <div class="bar" style={{ height: (d.bar / left.top) * 100 + '%' }}><i class="part k-acc" /></div>
              </button>
            ))}
          </div>
          <svg class="line dpath" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={path} vector-effect="non-scaling-stroke" /></svg>
          {data.map((d, i) => d.line != null && <i class="ldot" key={i} style={{ left: x(i) + '%', bottom: (d.line / right.top) * 100 + '%' }} />)}
        </div>
        <div class="yaxis right" aria-hidden="true">{right.ticks.map(v => <span class="yt" key={v} style={{ bottom: (v / right.top) * 100 + '%' }}>{fmtLine(v)}</span>)}</div>
        <div class="xaxis" aria-hidden="true">{data.map((d, i) => <span class="xl" key={d.title}>{i % every === 0 ? d.xlabel : ''}</span>)}</div>
      </div>
      <Legend items={[{ cls: 'k-acc', label: `${barLabel} (left axis)` }, { cls: 'key-dot', label: `${lineLabel} (right axis)` }, { cls: 'key-line', label: smoothLabel }]} />
      <TableView headers={['Week', barLabel, lineLabel, smoothLabel]} rows={data.map(d => [d.title, fmtBar(d.bar), d.line == null ? '—' : fmtLine(d.line), d.smooth == null ? '—' : fmtLine(d.smooth)])} />
      {t.node}
    </figure>
  );
}

/* ── how rates are spread: shifts per rate bin, with the median and the mean marked. Mean above median = a few big shifts. ── */
export function Histogram({ title, sub, h, fmt }: { title: string; sub?: string; h: Histo | null; fmt: (v: number) => string }) {
  const t = useTip();
  if (!h) return <EmptyFigure title={title} text="Needs at least three shifts with hours and tips." />;
  const max = Math.max(...h.bins.map(b => b.n)), scale = niceScale(max * 1.08), lo = h.bins[0]!.lo, span = h.bins.length * h.width;
  const at = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  const every = Math.max(1, Math.ceil(h.bins.length / 8));
  return (
    <figure class="viz" role="group" aria-label={title} ref={t.host}>
      <Cap title={title} sub={sub} />
      <div class="plot" style={{ '--plot-h': '148px' }}>
        <div class="yaxis" aria-hidden="true">{scale.ticks.map(v => <span class="yt" key={v} style={{ bottom: (v / scale.top) * 100 + '%' }}>{v}</span>)}</div>
        <div class="area">
          {scale.ticks.map(v => <div class="gl" key={v} style={{ bottom: (v / scale.top) * 100 + '%' }} />)}
          <div class="cols">
            {h.bins.map(b => {
              const rows = [{ name: b.n === 1 ? 'shift' : 'shifts', value: String(b.n) }];
              return (
                <button type="button" class="col" key={b.lo} aria-label={`${fmt(b.lo)} to ${fmt(b.hi)} per hour: ${b.n} shifts`} {...t.bind(`${fmt(b.lo)} – ${fmt(b.hi)} per hour`, rows)}>
                  <div class="bar wide" style={{ height: (b.n / scale.top) * 100 + '%' }}><i class="part k-acc" /></div>
                </button>
              );
            })}
          </div>
          <i class="mark median" style={{ left: at(h.median) + '%' }} /><i class="mark mean" style={{ left: at(h.mean) + '%' }} />
        </div>
        <div class="xaxis" aria-hidden="true">{h.bins.map((b, i) => <span class="xl" key={b.lo}>{i % every === 0 ? fmt(b.lo) : ''}</span>)}</div>
      </div>
      <Legend items={[{ cls: 'key-median', label: `Median ${fmt(h.median)}` }, { cls: 'key-mean', label: `Mean ${fmt(h.mean)}` }]} />
      <TableView headers={['Rate per hour', 'Shifts']} rows={h.bins.map(b => [`${fmt(b.lo)} – ${fmt(b.hi)}`, String(b.n)])} />
      {t.node}
    </figure>
  );
}

/* ── a change against the span before: an arrow and a percentage (never colour alone). `neutral` = no good or bad (hours). ── */
export function Delta({ pct, vs, neutral }: { pct: number | null; vs: string; neutral?: boolean }) {
  if (pct == null) return <span class="muted">nothing to compare yet</span>;
  const r = Math.round(pct), tone = neutral || r === 0 ? 'flat' : r > 0 ? 'up' : 'down';
  return <span class={'delta ' + tone}>{r > 0 ? '▲' : r < 0 ? '▼' : '▬'} {Math.abs(r)}% <span class="muted">vs {vs}</span></span>;
}
