import { useId } from 'preact/hooks';
import { from12, minuteOptions, to12 } from '../lib/time12.ts';
import { Icon } from './Icon.tsx';

/** A time as hour · minute · AM/PM, never a 24-hour clock. Reads and writes the form's 'HH:MM' string ('' = not set).
 *  `pm` is the half an empty field starts in when an hour is first picked (shifts mostly start in the evening). */
export function TimeField({ label, value, onChange, invalid, pm: startPm = true, compact }: {
  label: string; value: string; onChange: (hhmm: string) => void; invalid?: boolean; pm?: boolean;
  /** A table cell: the label is for screen readers only and there is no clear button. */
  compact?: boolean;
}) {
  const t = to12(value), id = useId();
  const set = (patch: Partial<{ h: number; m: number; pm: boolean }>) =>
    onChange(from12({ h: t?.h ?? 12, m: t?.m ?? 0, pm: t?.pm ?? startPm, ...patch }));
  return (
    <fieldset class={compact ? 'timefield compact' : 'timefield'} aria-invalid={invalid || undefined}>
      <legend class={compact ? 'sr-only' : 'label-text'}>{label}</legend>
      <div class="timefield-row">
        <select class="input" id={`${id}-hour`} name={`${id}-hour`} aria-label={`${label} hour`} value={t ? String(t.h) : ''} onChange={e => set({ h: +e.currentTarget.value })}>
          {!t && <option value="">–</option>}
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={String(h)}>{h}</option>)}
        </select>
        <span aria-hidden="true">:</span>
        <select class="input" id={`${id}-minute`} name={`${id}-minute`} aria-label={`${label} minutes`} value={t ? String(t.m) : ''} disabled={!t} onChange={e => set({ m: +e.currentTarget.value })}>
          {!t && <option value="">––</option>}
          {minuteOptions(t?.m ?? null).map(m => <option key={m} value={String(m)}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <div class="seg" role="radiogroup" aria-label={`${label} AM or PM`}>
          {(['AM', 'PM'] as const).map(p => (
            <label key={p}>
              <input type="radio" name={`${id}-half`} checked={t ? t.pm === (p === 'PM') : false} disabled={!t} onChange={() => set({ pm: p === 'PM' })} />
              <span>{p}</span>
            </label>
          ))}
        </div>
        {t && !compact && <button type="button" class="btn btn-quiet btn-icon" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')}><Icon name="x" /></button>}
      </div>
    </fieldset>
  );
}
