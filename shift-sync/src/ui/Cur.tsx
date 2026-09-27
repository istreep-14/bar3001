import { DASH, int } from '../lib/format.ts';

/** A whole number for a money cell: no $ sign (the head says what it is), centered like everything else. */
export function Cur({ n }: { n: number | null | undefined }) {
  return <>{n == null ? DASH : int(n)}</>;
}
