import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { PAGE_SIZES, paginate, sortRows } from '../lib/table.ts';
import type { Dir, SortValue } from '../lib/table.ts';
import { Icon } from './Icon.tsx';

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
}
interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Row activation contract: the same callback a card or calendar day would fire. */
  onRow?: (row: T) => void;
  selectedId?: string | null;
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
const SIZE_KEY = 'pagesize';
const readSize = (): number => { try { const n = Number(localStorage.getItem(SIZE_KEY)); return (PAGE_SIZES as readonly number[]).includes(n) && localStorage.getItem(SIZE_KEY) !== null ? n : 50; } catch { return 50; } };

/** The one grid component: sortable heads, paging, arrow-key row navigation. Plain rows, no grouping. */
export function Table<T>({ rows, columns, rowKey, onRow, selectedId, label, defaultSort, paginate: paged, fill, footer }: Props<T>) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [size, setSize] = useState(readSize);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length, sort?.key, sort?.dir, size]);

  const col = sort ? columns.find(c => c.key === sort.key) : undefined;
  const sorted = sort && col?.sort ? sortRows(rows, col.sort, sort.dir) : rows;
  const pg = paginate(sorted, paged ? size : 0, page);

  const toggle = (c: Column<T>) => {
    if (sort?.key === c.key) { setSort({ key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }); return; }
    // First click: biggest/latest first for numbers, A to Z for text.
    const probe = rows.map(c.sort!).find(v => v != null && v !== '');
    setSort({ key: c.key, dir: typeof probe === 'number' ? 'desc' : 'asc' });
  };

  // Run-length the columns by group label so one band spans each group.
  const colBands: { label: string | undefined; span: number; first: Column<T> }[] = [];
  if (columns.some(c => c.group)) for (const c of columns) {
    const last = colBands[colBands.length - 1];
    if (last && last.label === c.group && c.group) last.span++; else colBands.push({ label: c.group, span: 1, first: c });
  }

  return (
    <>
      <div class={fill ? 'tbl-wrap fill' : 'tbl-wrap'}>
        <table class="tbl" aria-label={label}>
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
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pg.rows.map(r => {
              const id = rowKey(r);
              return (
                <tr key={id} data-row={onRow ? '' : undefined} tabIndex={onRow ? 0 : undefined} aria-selected={selectedId === id ? 'true' : undefined}
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
                  {columns.map(c => <td key={c.key} class={cls(c)}>{c.cell(r)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {((paged && rows.length > PAGE_SIZES[0]) || footer) && (
        <div class="pager">
          {footer}
          {paged && rows.length > PAGE_SIZES[0] && <><label class="pager-size">Rows
            <select class="input" value={size} aria-label="Rows per page"
              onChange={e => { const n = Number(e.currentTarget.value); setSize(n); try { localStorage.setItem(SIZE_KEY, String(n)); } catch { /* private mode */ } }}>
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
