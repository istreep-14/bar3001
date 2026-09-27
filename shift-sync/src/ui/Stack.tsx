import type { ComponentChildren } from 'preact';

/** One table cell: the fact on the first line, the details that belong with it underneath. */
export function Stack({ title, lines, extra }: { title: ComponentChildren; lines?: ComponentChildren[]; extra?: ComponentChildren }) {
  return (
    <span class="stack">
      <span class="stack-title">{title}</span>
      {lines?.map((line, i) => (line == null || line === false || line === '') ? null : <span class="stack-meta" key={i}>{line}</span>)}
      {extra}
    </span>
  );
}
