import { useEffect, useState, type RefObject } from "react";

// Kutunun piksel boyutunu izler (ResizeObserver yoksa — örn. testte — varsayılan boyut kalır).
export function useSize(ref: RefObject<HTMLElement>, initial = { w: 600, h: 300 }) {
  const [size, setSize] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
