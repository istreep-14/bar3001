import { useEffect, useRef, useState } from 'preact/hooks';
import { NONE, toggleFilter } from '../lib/filters.ts';
import type { Filters } from '../lib/filters.ts';
import { Icon } from './Icon.tsx';
import styles from './FilterMenu.module.css';

/** One thing a list can be filtered by, and the values it takes (with how many rows have each). */
export interface Facet { key: string; label: string; options: { value: string; label?: string; count: number }[] }

/** "Filter": a button that opens a panel of every facet's values as toggles (any picked value of a facet passes; every facet
 *  with picks must pass), and a removable chip for each pick beside it. Driven by props: the page holds the picks and applies them
 *  (`applyFilters` in lib/filters.ts). */
export function FilterMenu({ facets, value, onChange }: { facets: Facet[]; value: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const picked = facets.flatMap(f => (value[f.key] ?? []).map(v => ({ f, v })));
  const name = (f: Facet, v: string) => f.options.find(o => o.value === v)?.label ?? (v === NONE ? 'None' : v);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div class={styles.wrap} ref={root}>
      <button type="button" class="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="log" /> Filter{picked.length > 0 && <span class={styles.count}>{picked.length}</span>}
      </button>
      {picked.map(({ f, v }) => (
        <span key={f.key + v} class={`chip ${styles.pick}`}>{f.label}: {name(f, v)}
          <button type="button" aria-label={`Stop filtering by ${f.label} ${name(f, v)}`} onClick={() => onChange(toggleFilter(value, f.key, v))}><Icon name="x" /></button>
        </span>
      ))}
      {picked.length > 1 && <button type="button" class="linkbtn" onClick={() => onChange({})}>Clear all</button>}
      {open && (
        <div class={styles.panel} role="dialog" aria-label="Filter">
          {facets.map(f => (
            <div key={f.key} class={styles.facet} role="group" aria-label={f.label}>
              <span class="label-text">{f.label}</span>
              <div class={styles.options}>
                {f.options.map(o => (
                  <button key={o.value} type="button" class="tog" aria-pressed={(value[f.key] ?? []).includes(o.value)} onClick={() => onChange(toggleFilter(value, f.key, o.value))}>
                    {o.label ?? (o.value === NONE ? 'None' : o.value)} <span class={styles.n}>{o.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
