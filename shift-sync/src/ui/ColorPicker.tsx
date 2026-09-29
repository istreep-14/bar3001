import { SWATCHES } from './swatches.ts';
import styles from './ColorPicker.module.css';

/** A row of round swatches (the palette, then any colour by hex), plus a first choice for "no colour of its own"
 *  (`none`: "Auto" for an avatar, "None" for a role). One control for every colour a person or a role can have. */
export function ColorPicker({ value, onChange, none, label }: { value: string | null; onChange: (v: string | null) => void; none: string; label: string }) {
  const custom = value?.startsWith('#') ? value : null;
  return (
    <div class={styles.swatches} role="radiogroup" aria-label={label}>
      <button type="button" role="radio" class={`${styles.swatch} ${styles.none}`} aria-checked={!value} onClick={() => onChange(null)}>{none}</button>
      {SWATCHES.map(c => (
        <button type="button" role="radio" key={c.id} class={styles.swatch} style={{ '--sw': `var(${c.token})` }} aria-checked={value === c.id} aria-label={c.label} title={c.label}
          onClick={() => onChange(c.id)} />
      ))}
      <label class={`${styles.swatch} ${styles.custom}`} data-on={custom ? '' : undefined} style={custom ? { '--sw': custom } : undefined} title="Any colour">
        <input type="color" value={custom ?? '#888888'} aria-label="Any colour" onInput={e => onChange(e.currentTarget.value)} />
      </label>
    </div>
  );
}
