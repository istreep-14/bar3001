import type { ComponentChildren } from 'preact';

export interface TabChoice<V extends string> { value: V; label: string; count?: number }

/** Quick views over a list, as tabs on top of its table: "All 42 · Day 18 · Night 24". The picked tab shares the table
 *  card's fill and runs into it (ui.css .ttabs). One choice at a time, so it is a radio group, not a tablist.
 *  `tools` sit on the same row, at the right: search, filter, group, range. They are not views — they narrow or
 *  arrange the rows the view is showing. */
export function TableTabs<V extends string>({ label, value, tabs, onChange, tools }: {
  label: string; value: V; tabs: TabChoice<V>[]; onChange: (v: V) => void; tools?: ComponentChildren;
}) {
  return (
    <div class="tabhead">
      <div class="ttabs" role="radiogroup" aria-label={label}>
        {tabs.map(t => (
          <button key={t.value} type="button" role="radio" aria-checked={t.value === value} class="ttab" onClick={() => onChange(t.value)}>
            {t.label}{t.count != null && <span class="ttab-n">{t.count}</span>}
          </button>
        ))}
      </div>
      {tools && <div class="sheet-tools">{tools}</div>}
    </div>
  );
}
