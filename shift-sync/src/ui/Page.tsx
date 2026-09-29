import type { ComponentChildren } from 'preact';
import { PanelHead } from './PanelHead.tsx';

/** One page: a title and its tools, then a body. `fill` locks the shell so the body scrolls.
 *  `side` is the column beside the body. `flush` lets a table run to the panel edge. */
export function Page({ title, id, tools, fill, flush, side, bodyClass, live, children }: {
  title: string;
  id: string;
  tools?: ComponentChildren;
  fill?: boolean;
  flush?: boolean;
  side?: ComponentChildren;
  bodyClass?: string;
  live?: boolean;
  children: ComponentChildren;
}) {
  const body = <div class={['panel-body', flush ? 'flush' : '', bodyClass ?? ''].filter(Boolean).join(' ')}>{children}</div>;
  return (
    <section class={fill ? 'panel fill' : 'panel'} aria-labelledby={id}>
      <PanelHead title={title} id={id} live={live}>{tools}</PanelHead>
      {side != null ? <div class="split">{body}{side}</div> : body}
    </section>
  );
}
