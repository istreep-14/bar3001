import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

/** A small card that opens beside its trigger while it's hovered or focused, for detail too rich for a tooltip (faces and
 *  names, say). Placed with fixed positioning from the trigger's box, so a scrolling table's edges don't clip it; it opens
 *  below, or above when there isn't room. Styles: `.hovercard` in ui.css. */
export function HoverCard({ card, children, label }: { card: ComponentChildren; children: ComponentChildren; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom > 240;
    setAt({ left: Math.max(8, Math.min(r.left - 8, window.innerWidth - 264)), ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) });
  };
  const close = () => setAt(null);
  return (
    <span ref={ref} class="hovercard-at" tabIndex={0} aria-label={label} onPointerEnter={open} onPointerLeave={close} onFocus={open} onBlur={close}>
      {children}
      {at && <span class="hovercard" role="tooltip" style={{ left: `${at.left}px`, ...(at.top != null ? { top: `${at.top}px` } : { bottom: `${at.bottom}px` }) }}>{card}</span>}
    </span>
  );
}
