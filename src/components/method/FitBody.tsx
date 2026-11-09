import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Keeps the text of a cadre fully visible: starts at the configured size (pt) and
 * shrinks the font until nothing overflows the frame.
 */
export function FitBody({
  fontSize,
  className,
  style,
  children,
  deps = [],
}: {
  fontSize: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  deps?: unknown[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = fontSize;
      el.style.fontSize = `${size}pt`;
      let guard = 0;
      while (el.scrollHeight > el.clientHeight + 1 && size > 6 && guard < 80) {
        size -= 0.5;
        el.style.fontSize = `${size}pt`;
        guard++;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const mo = new MutationObserver(fit);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, ...deps]);

  return (
    <div ref={ref} className={className} style={{ ...style, fontSize: `${fontSize}pt` }}>
      {children}
    </div>
  );
}
