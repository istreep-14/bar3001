import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

/* How wide an element is, in rem, kept current as it resizes (a ResizeObserver on its inline size). A data sheet reads
 * it to pick its columns: the width the table actually has, not the window's, so the side panel, the drawer and the
 * rail all count. */

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/** `[width, ref]`: put `ref` on the element to measure. The width is in rem, rounded to a quarter, and null until the
 *  element has been measured. The ref is a callback, so it follows the element when a keyed view remounts it. */
export function useWidth<E extends Element = HTMLElement>(): [number | null, (el: E | null) => void] {
  const [width, setWidth] = useState<number | null>(null);
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: E | null) => {
    obs.current?.disconnect();
    obs.current = null;
    if (!el) return;
    const read = (px: number) => { const rem = Math.round((px / remPx()) * 4) / 4; setWidth(w => (w === rem ? w : rem)); };
    read(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    obs.current = new ResizeObserver(entries => {
      const e = entries[entries.length - 1];
      if (e) read(e.borderBoxSize?.[0]?.inlineSize ?? e.contentRect.width);
    });
    obs.current.observe(el);
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return [width, ref];
}

/** wide: every column; mid: a laptop with the side panel (some columns hide); narrow: a phone or a squeezed window. */
export type Tier = 'wide' | 'mid' | 'narrow';
/** The default thresholds, in rem of the table's own width: under `narrow` is 'narrow', under `mid` is 'mid'. At 1440
 *  the Shifts sheet is about 51.75rem (wide), at 1280 about 41.75rem (mid), on a phone about 23.4rem (narrow). */
export const TIERS = { narrow: 36, mid: 46 };

/** A width's tier. A view whose columns need a different break passes its own (`{ mid: 47 }`). Before the first measure
 *  (null) it is `fallback`, so the first paint is the likely one. */
export function tierOf(rem: number | null, at: Partial<typeof TIERS> = {}, fallback: Tier = 'wide'): Tier {
  if (rem == null) return fallback;
  const t = { ...TIERS, ...at };
  return rem < t.narrow ? 'narrow' : rem < t.mid ? 'mid' : 'wide';
}
