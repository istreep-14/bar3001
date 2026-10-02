import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';

/** Search as a sheet-row button: a fixed icon. The field opens under it, so the row never grows with the query.
 *  A dot under the icon means a query is on. */
export function SheetSearch({ id, label, placeholder, value, onChange }: {
  id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const on = value.trim().length > 0;
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('input')?.focus();
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div class="tool-wrap" ref={root}>
      <button type="button" class="tool" data-on={on ? '' : undefined} aria-expanded={open} aria-label={on ? `${label}, ${value.trim()}` : label} title={label} onClick={() => setOpen(!open)}>
        <Icon name="search" />
        {on && <span class="tool-mark" />}
      </button>
      {open && (
        <div class="tool-pop" role="dialog" aria-label={label}>
          <input class="input" id={id} name={id} type="search" placeholder={placeholder} aria-label={label} value={value} onInput={e => onChange(e.currentTarget.value)} />
        </div>
      )}
    </div>
  );
}
