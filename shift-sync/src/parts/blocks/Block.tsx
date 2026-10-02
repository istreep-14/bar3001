import type { ComponentChildren } from 'preact';
import { go } from '../../router.ts';
import type { Screen } from '../../router.ts';
import { Icon } from '../../ui/Icon.tsx';
import s from './blocks.module.css';

/* A block: one rounded card holding one idea (a chart, a list, a figure), a title at its top left and, at its top right, a
 * round arrow to the page it summarises. Three tones:
 *   glass    the frosted card most blocks are
 *   inverse  the one dark card in a group: today, or what needs you
 *   bare     no card of its own, for a block set inside another card */
export function Block({ title, sub, to, toLabel, tone = 'glass', tools, class: cls, children }: {
  title: ComponentChildren;
  sub?: ComponentChildren;
  /** The page this block summarises: a round arrow at the top right opens it. */
  to?: Screen;
  toLabel?: string;
  tone?: 'glass' | 'inverse' | 'bare';
  /** Controls beside the arrow (a pill switch, a period). */
  tools?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={`${s.block}${cls ? ' ' + cls : ''}`} data-tone={tone}>
      <header class={s.head}>
        <div class={s.titles}>
          <h3 class={s.title}>{title}</h3>
          {sub && <p class={s.sub}>{sub}</p>}
        </div>
        {(tools || to) && (
          <div class={s.tools}>
            {tools}
            {to && <ArrowLink to={to} label={toLabel ?? `Open ${typeof title === 'string' ? title.toLowerCase() : 'page'}`} />}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

/** The round ↗ in a block's corner: a link to the page behind the block. */
export function ArrowLink({ to, label }: { to: Screen; label: string }) {
  return (
    <a class={s.arrow} href={`#/${to}`} aria-label={label} title={label} onClick={e => { e.preventDefault(); go(to); }}>
      <Icon name="out" />
    </a>
  );
}

/** A small pill switch for a block's own choice (8 weeks / 12 weeks, Tips / Total). */
export function PillSwitch<T extends string | number>({ label, value, choices, onChange }: {
  label: string; value: T; choices: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div class={s.pills} role="radiogroup" aria-label={label}>
      {choices.map(c => (
        <button type="button" key={String(c.value)} role="radio" aria-checked={c.value === value} class={s.pill} onClick={() => onChange(c.value)}>{c.label}</button>
      ))}
    </div>
  );
}
