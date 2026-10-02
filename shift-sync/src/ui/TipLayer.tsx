import { useEffect, useState } from 'preact/hooks';

type At = { text: string; left: number; top?: number; bottom?: number };

/** One floating tip for every `.tip[data-tip]` on the page. Drawn up here, fixed to the viewport, the same card as a
 *  crew stack's hover card — a table cell's overflow would clip the old bubble that lived inside the cell. */
export function TipLayer() {
  const [at, setAt] = useState<At | null>(null);
  useEffect(() => {
    let host: HTMLElement | null = null;
    let timer = 0;
    const of = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('.tip[data-tip]') : null);
    const place = (el: HTMLElement) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom > 140;
      setAt({
        text,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 264)),
        ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 })
      });
    };
    const arm = (el: HTMLElement, now: boolean) => {
      if (host === el && !now) return;
      host = el;
      window.clearTimeout(timer);
      if (now) place(el);
      else timer = window.setTimeout(() => { if (host === el) place(el); }, 160);
    };
    const clear = () => { host = null; window.clearTimeout(timer); setAt(null); };
    const over = (e: PointerEvent) => { const el = of(e.target); if (el) arm(el, false); else if (host) clear(); };
    const focus = (e: FocusEvent) => { const el = of(e.target); if (el) arm(el, true); };
    const blur = (e: FocusEvent) => { if (host && !host.contains(e.relatedTarget as Node | null)) clear(); };
    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    document.addEventListener('scroll', clear, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('scroll', clear, true);
    };
  }, []);
  if (!at) return null;
  return (
    <span class="hovercard hovercard-plain" role="tooltip" style={{ left: `${at.left}px`, ...(at.top != null ? { top: `${at.top}px` } : { bottom: `${at.bottom}px` }) }}>{at.text}</span>
  );
}
