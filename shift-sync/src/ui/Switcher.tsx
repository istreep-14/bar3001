import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';
import type { IconName } from './Icon.tsx';
import styles from './Switcher.module.css';

export interface Choice<V extends string> { value: V; label: string; hint?: string }

/** A choice of one, as a button that drops down its options instead of a row of toggles: "Group: By week ▾". Picking one
 *  closes it. `children` sit under the options in the same panel (the period's own length or dates), and `note` is shown
 *  quietly on the button after the value (the dates a period resolves to). Picking a value in `stay` keeps it open, for
 *  a choice that is finished in `children`. With a `value` none of the choices has, the button is just its label: an
 *  action menu ("Add to shift ▾"). `compact` is the sheet-row form: a fixed icon button, with `mark` (a few characters
 *  of the current choice) under the icon. The name and the full value stay in the label, and in the menu. Driven by
 *  props, like FilterMenu. */
export function Switcher<V extends string>({ label, icon, value, choices, onChange, note, children, stay, align, disabled, compact, mark, tone }: {
  label: string; icon?: IconName; value: V; choices: Choice<V>[]; onChange: (v: V) => void;
  note?: ComponentChildren; children?: ComponentChildren; stay?: V[]; align?: 'left' | 'right'; disabled?: boolean;
  compact?: boolean; mark?: string; tone?: 'add';
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = choices.find(c => c.value === value);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const named = current ? `${label}, ${current.label}` : label;
  return (
    <div class={compact ? 'tool-wrap' : styles.wrap} ref={root} onFocusOut={e => { if (open && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      {compact ? (
        <button type="button" class="tool" data-on={mark != null ? '' : undefined} data-tone={tone} aria-haspopup="dialog" aria-expanded={open} aria-label={named} title={named} disabled={disabled} onClick={() => setOpen(!open)}>
          {icon && <Icon name={icon} />}
          {mark != null && <span class="tool-mark">{mark}</span>}
        </button>
      ) : (
        <button type="button" class={`btn ${styles.button}`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
          {icon && <Icon name={icon} />}
          <span class={current ? styles.label : styles.value}>{label}</span>
          {current && <span class={styles.value}>{current.label}</span>}
          {note && <span class={styles.note}>{note}</span>}
          <span class={styles.chev} aria-hidden="true"><Icon name="chevron" /></span>
        </button>
      )}
      {open && !disabled && (
        <div class={`${styles.panel} ${align === 'right' || compact ? styles.right : ''}`} role="dialog" aria-label={label}>
          <div class={styles.options} role="radiogroup" aria-label={label}>
            {choices.map(c => (
              <button key={c.value} type="button" role="radio" aria-checked={c.value === value} class={styles.option}
                onClick={() => { onChange(c.value); if (!stay?.includes(c.value)) setOpen(false); }}>
                <span class={styles.tick} aria-hidden="true">{c.value === value && <Icon name="check" />}</span>
                <span class={styles.optLabel}>{c.label}</span>
                {c.hint && <span class={styles.hint}>{c.hint}</span>}
              </button>
            ))}
          </div>
          {children && <div class={styles.extra}>{children}</div>}
        </div>
      )}
    </div>
  );
}
