import { useEffect, useRef, useState } from "react";

/** A4 page in CSS px (96dpi). */
export const PAGE_W = (210 / 25.4) * 96;
export const PAGE_H = (297 / 25.4) * 96;

/** Scale factor so an A4 page fits the container width (zoom-synced overlays use it too). */
export function usePageScale(maxScale = 1) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(Math.min(maxScale, Math.max(0.2, (w - 4) / PAGE_W)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxScale]);
  return { ref, scale };
}
