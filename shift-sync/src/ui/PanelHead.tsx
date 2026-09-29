import type { ComponentChildren } from 'preact';

/* Every page: a title on the grey canvas (tools on the right), then panels that stay on that grey.
 *   panel-head   title · scope / filters / the page's own action
 *   panel-body   a hairline around the table, chart, calendar, or the summary beside a table */
export function PanelHead({ title, id, live, children }: { title: string; id?: string; live?: boolean; children?: ComponentChildren }) {
  return <header class="panel-head"><h2 id={id} aria-live={live ? 'polite' : undefined}>{title}</h2>{children && <div class="panel-tools">{children}</div>}</header>;
}
