import { Fragment } from 'preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { PAGE_SIZES, paginate, pushSort, resizeWeights, sortBy } from '../lib/table.ts';
import type { Dir, SortKey, SortValue } from '../lib/table.ts';
import { Icon } from './Icon.tsx';
import { oneOf, persisted } from '../data/persisted.ts';

export interface Column<T> {
  key: string;
  head: string;
  className?: string;
  cell: (row: T) => ComponentChildren;
  /** Makes the header a sort control. Blanks (null/'') always sort last. */
  sort?: (row: T) => SortValue;
  /** Starts a new column group: the prominent separator rule. */
  groupStart?: boolean;
  /** Header band over consecutive columns sharing the same label (Time, Income). */
  group?: string;
  /** The full name for a short head ('CT' -> 'Bartenders on the shift'). Shown as a tooltip. */
  hint?: string;
  /** A computed result (Hours from Start/End, Total from Tips/Other), named in the head's tooltip. */
  derived?: string;
  /** With `group`: said once, on a block's first row; the rows under it leave the cell blank (screen readers still hear it). */
  once?: boolean;
  /** A share of the width: once any column has one, the table lays out to those shares (2 is twice as wide as 1), and the
   *  edges between them can be dragged. A column without one (a chevron) keeps its own small width. */
  weight?: number;
}
interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Row activation contract: the same callback a card or calendar day would fire. */
  onRow?: (row: T) => void;
  selectedId?: string | null;
  /** Marks rows as selected by a rule instead of one id: every line of the shift open in the drawer, say. */
  selected?: (row: T) => boolean;
  /** Rows that share a key and sit together once sorted are one block: no rule between them, a `once` column filled only
   *  on the first, a rule and a little air between blocks. Sorted another way, the blocks break up and each row says it all. */
  group?: (row: T) => string;
  /** The Log's look: single-line rows at the Log's size, inset from the panel's edges, the accent bar on a selected row. */
  log?: boolean;
  /** A data grid, for looking things up across many columns: full-width rows with a faint stripe, the first column held in
   *  place while the rest scroll sideways, and a rule between column groups. */
  grid?: boolean;
  /** A totals row pinned under the rows, a cell per column key (what it says is the page's: sums of every row, not the page). */
  foot?: Partial<Record<string, ComponentChildren>>;
  /** Rows whose cells run two lines (a name over a full name): a little taller, every row the same height. */
  tall?: boolean;
  /** Sorts before any column, higher first: a search's best matches stay on top whatever column is sorted under them. */
  rank?: (row: T) => number;
  /** A row's tone: 'me' (your own row, a faint gold fill), 'manager' (a faint blue one) or 'muted' (greyed, like an inactive person). */
  tone?: (row: T) => 'me' | 'manager' | 'muted' | undefined;
  label: string;
  /** Initial sort; without it rows keep the order they arrive in until a header is clicked. */
  defaultSort?: { key: string; dir: Dir };
  /** Rows-per-page and prev/next below the table. Hidden while everything fits on the smallest page. */
  paginate?: boolean;
  /** Fill the remaining height of the screen and scroll inside, with the head kept in view. */
  fill?: boolean;
  /** Inline figures on the left of the bar under the table (a summary of what is shown). */
  footer?: ComponentChildren;
}

const cls = (c: Column<any>) => [c.groupStart && 'gs', c.className].filter(Boolean).join(' ') || undefined;
/* Column shares someone dragged, remembered per table (by its label) on this device. Double-click an edge to forget them. */
const SHARE = 96;   // percent of the width the weighted columns split; the rest is the chevron's
const widthsKey = (label: string) => `cols:${label}`;
function readWidths(label: string): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(widthsKey(label)) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function writeWidths(label: string, w: Record<string, number> | null) {
  try { if (w) localStorage.setItem(widthsKey(label), JSON.stringify(w)); else localStorage.removeItem(widthsKey(label)); } catch { /* private mode */ }
}

/** Rows per page, remembered once for every table. */
const [pageSize, setPageSize] = persisted<number>('pagesize', oneOf(PAGE_SIZES), 50);

/** The one grid component: sortable heads, paging, arrow-key row navigation, and rows grouped into blocks that say a value once. */
export function Table<T>({ rows, columns, rowKey, onRow, selectedId, selected, group, log, grid, foot, tone, tall, rank, label, defaultSort, paginate: paged, fill, footer }: Props<T>) {
  // The sorts clicked, newest first: the top one decides, the ones under it break its ties (so the order you had is kept).
  const [sorts, setSorts] = useState<{ key: string; dir: Dir }[]>(defaultSort ? [defaultSort] : []);
  const sort = sorts[0] ?? null;
  const size = pageSize.value;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length, sort?.key, sort?.dir, size]);

  const keys: SortKey<T>[] = [
    ...(rank ? [{ get: rank, dir: 'desc' as Dir }] : []),
    ...sorts.flatMap(s => { const c = columns.find(x => x.key === s.key); return c?.sort ? [{ get: c.sort, dir: s.dir }] : []; })
  ];
  const sorted = sortBy(rows, keys);
  const pg = paginate(sorted, paged ? size : 0, page);

  const toggle = (c: Column<T>) => {
    // First click: biggest/latest first for numbers, A to Z for text.
    const probe = rows.map(c.sort!).find(v => v != null && v !== '');
    setSorts(pushSort(sorts, c.key, typeof probe === 'number' ? 'desc' : 'asc'));
  };

  // Widths: the columns' shares, as dragged (and remembered) or as given.
  const table = useRef<HTMLTableElement>(null);
  const weighted = columns.filter(c => c.weight);
  const [saved, setSaved] = useState<Record<string, number>>(() => (weighted.length ? readWidths(label) : {}));
  const weights = weighted.map(c => saved[c.key] ?? c.weight!);
  const total = weights.reduce((a, b) => a + b, 0);
  const startResize = (i: number) => (e: PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = weights, perUnit = ((table.current?.offsetWidth ?? 1) * SHARE) / 100 / total;
    let last = saved;
    const move = (ev: PointerEvent) => {
      const w = resizeWeights(w0, i, (ev.clientX - x0) / perUnit);
      last = Object.fromEntries(weighted.map((c, k) => [c.key, Math.round(w[k]! * 100) / 100]));
      setSaved(last);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); writeWidths(label, last); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const resetWidths = (e: Event) => { e.stopPropagation(); setSaved({}); writeWidths(label, null); };

  // Run-length the columns by group label so one band spans each group.
  const colBands: { label: string | undefined; span: number; first: Column<T> }[] = [];
  if (columns.some(c => c.group)) for (const c of columns) {
    const last = colBands[colBands.length - 1];
    if (last && last.label === c.group && c.group) last.span++; else colBands.push({ label: c.group, span: 1, first: c });
  }

  return (
    <>
      <div class={['tbl-wrap', fill && 'fill', log && 'tbl-log', grid && 'tbl-grid', weighted.length && 'tbl-fixed'].filter(Boolean).join(' ')}>
        <table ref={table} class="tbl" aria-label={label} data-grouped={group ? '' : undefined}>
          {weighted.length > 0 && (
            <colgroup>{columns.map(c => <col key={c.key} style={c.weight ? { width: `${((saved[c.key] ?? c.weight) / total) * SHARE}%` } : undefined} />)}</colgroup>
          )}
          <thead data-grouped={colBands.length ? '' : undefined}>
            {colBands.length > 0 && (
              <tr class="gh">{colBands.map((b, i) => <th key={i} class={i ? 'gs' : undefined} colSpan={b.span} scope="colgroup">{b.label}</th>)}</tr>
            )}
            <tr>
              {columns.map(c => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} class={cls(c)} scope="col" title={[c.hint, c.derived && `Derived: ${c.derived}`].filter(Boolean).join(' · ') || undefined}
                    aria-sort={c.sort ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
                    {c.sort
                      ? <button type="button" class="th-sort" onClick={() => toggle(c)}>{c.head}<Icon name={active && sort!.dir === 'asc' ? 'up' : 'down'} /></button>
                      : c.head}
                    {c.weight && weighted.indexOf(c) < weighted.length - 1 && (
                      <span class="col-resize" aria-hidden="true" title="Drag to resize. Double-click to reset." onPointerDown={startResize(weighted.indexOf(c))} onDblClick={resetWidths} />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pg.rows.map((r, i) => {
              const id = rowKey(r);
              const first = !group || i === 0 || group(r) !== group(pg.rows[i - 1]!);
              const last = !!group && (i === pg.rows.length - 1 || group(r) !== group(pg.rows[i + 1]!));
              const on = selectedId === id || !!selected?.(r);
              return (
                <Fragment key={id}>
                  {group && first && i > 0 && <tr class="tbl-sep" aria-hidden="true"><td colSpan={columns.length} /></tr>}
                  <tr data-row={onRow ? '' : undefined} data-first={group && first ? '' : undefined}  data-last={last ? '' : undefined} data-tone={tone?.(r)} data-tall={tall ? '' : undefined} tabIndex={onRow ? 0 : undefined} aria-current={on ? 'true' : undefined}
                    onClick={() => onRow?.(r)}
                    onKeyDown={ev => {
                      const el = ev.currentTarget as HTMLElement;
                      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onRow?.(r); }
                      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                        ev.preventDefault();
                        const next = (n: Element | null) => (ev.key === 'ArrowDown' ? n?.nextElementSibling : n?.previousElementSibling) as HTMLElement | null;
                        let n = next(el);
                        while (n && !n.hasAttribute('data-row')) n = next(n);
                        n?.focus();
                      }
                    }}>
                    {columns.map(c => <td key={c.key} class={cls(c)}>{c.once && !first ? <span class="sr-only">{c.cell(r)}</span> : c.cell(r)}</td>)}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          {foot && (
            <tfoot>
              <tr>{columns.map(c => <td key={c.key} class={cls(c)}>{foot[c.key]}</td>)}</tr>
            </tfoot>
          )}
        </table>
      </div>
      {((paged && rows.length > PAGE_SIZES[0]) || footer) && (
        <div class="pager">
          {footer}
          {paged && rows.length > PAGE_SIZES[0] && <><label class="pager-size">Rows
            <select class="input" value={size} aria-label="Rows per page"
              onChange={e => setPageSize(Number(e.currentTarget.value))}>
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n === 0 ? 'All' : n}</option>)}
            </select>
          </label>
          <span class="pager-count" aria-live="polite">{pg.from}–{pg.to} of {pg.total}</span>
          <button type="button" class="btn btn-quiet btn-icon" onClick={() => setPage(pg.page - 1)} disabled={pg.page === 0} aria-label="Previous page"><Icon name="left" /></button>
          <button type="button" class="btn btn-quiet btn-icon" onClick={() => setPage(pg.page + 1)} disabled={pg.page >= pg.pages - 1} aria-label="Next page"><Icon name="chevron" /></button></>}
        </div>
      )}
    </>
  );
}
