import { dateCell, isPastYear } from '../lib/format.ts';

/** 'Sep 05', plus a quiet year when it isn't this year and the row isn't under a band that already names it. */
export function DateCell({ d, banded = false }: { d: string; banded?: boolean }) {
  return <>{dateCell(d)}{!banded && isPastYear(d) && <span class="yr"> {d.slice(0, 4)}</span>}</>;
}
