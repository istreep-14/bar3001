import type { ComponentChildren } from 'preact';

/* Every page: a title on the grey canvas (tools on the right), then one or more white cards.
 *   panel-head   title · scope / filters / the page's own action
 *   panel-body   the card: a table, chart, calendar, or the summary beside a table */
export function PanelHead({ title, id, children }: { title: string; id?: string; children?: ComponentChildren }) {
  return <header class="panel-head"><h2 id={id}>{title}</h2>{children && <div class="panel-tools">{children}</div>}</header>;
}
