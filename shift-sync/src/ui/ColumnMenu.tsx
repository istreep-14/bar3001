import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';
import styles from './FilterMenu.module.css';

/** "Columns": a button that opens a list of a table's optional columns to show or hide. Driven by props: the page keeps
 *  which are hidden (and remembers it). `icon` makes the button a small icon, to sit in a table head's corner. */
export function ColumnMenu<K extends string>({ options, hidden, onChange, icon }: { options: { key: K; label: string }[]; hidden: K[]; onChange: (hidden: K[]) => void; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const off = hidden.length;
  return (
    <div class={styles.wrap} ref={root}>
      {icon
        ? <button type="button" class={`btn btn-quiet btn-icon ${styles.corner}`} aria-expanded={open} aria-label="Columns" title="Columns" data-on={off ? '' : undefined} onClick={() => setOpen(!open)}><Icon name="table" /></button>
        : <button type="button" class="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="table" /> Columns{off > 0 && <span class={styles.count}>{options.length - off}/{options.length}</span>}
          </button>}
      {open && (
        <div class={`${styles.panel} ${styles.right}`} role="dialog" aria-label="Columns">
          <div class={styles.checks}>
            {options.map(o => (
              <label key={o.key} class={styles.check}>
                <input type="checkbox" id={`${uid}-${o.key}`} name={`${uid}-${o.key}`} checked={!hidden.includes(o.key)} onChange={e => onChange(e.currentTarget.checked ? hidden.filter(k => k !== o.key) : [...hidden, o.key])} />
                {o.label}
              </label>
            ))}
          </div>
          {off > 0 && <button type="button" class="linkbtn" onClick={() => onChange([])}>Show all</button>}
        </div>
      )}
    </div>
  );
}
