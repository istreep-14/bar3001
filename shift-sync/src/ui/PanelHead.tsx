import type { ComponentChildren } from 'preact';

/* Every page is a panel: a head (title on the left, its controls on the right), then the body.
 *   panel-head   title · scope / filters / the page's own action
 *   panel-body   tiles, then the table, chart or calendar */
export function PanelHead({ title, id, children }: { title: string; id?: string; children?: ComponentChildren }) {
  return <header class="panel-head"><h2 id={id}>{title}</h2>{children && <div class="panel-tools">{children}</div>}</header>;
}
