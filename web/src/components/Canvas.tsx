import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import GridLayout, { type Layout as GridItem } from "react-grid-layout";
import { GRID_SIZE } from "../config";
import { MIN_COLS } from "../layout/model";
import { useLayout } from "../layout/LayoutProvider";
import { registry as defaultRegistry } from "../modules";
import type { Registry } from "../modules/registry";
import { useSelection } from "../selection";
import { ModuleFrame } from "./ModuleFrame";

const DEFAULT_MIN = { w: 6, h: 4 };

function useWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(read);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [ref]);
  return width;
}

export function Canvas({ registry = defaultRegistry }: { registry?: Registry }) {
  const { status, layout, reload, close, commitRect } = useLayout();
  const { selected } = useSelection();
  const ref = useRef<HTMLElement>(null);
  const width = useWidth(ref);

  // Izgara hiçbir zaman MIN_COLS'tan dar olmaz; dar ekranda alan kaydırılır, kayıtlı konumlar bozulmaz.
  const cols = Math.max(MIN_COLS, Math.floor(width / GRID_SIZE));

  // Koddan silinmiş modüllerin kaydı sunucuda kalır ama çizilmez.
  const placed = layout.items.flatMap((item) => {
    const def = registry.get(item.id);
    return def ? [{ item, def }] : [];
  });

  const gridItems: GridItem[] = placed.map(({ item, def }) => ({
    i: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: def.minSize?.w ?? DEFAULT_MIN.w,
    minH: def.minSize?.h ?? DEFAULT_MIN.h,
  }));

  // Yalnız kullanıcı bırakınca kaydederiz; sadece o modülün dikdörtgeni alınır.
  const onStop = (_layout: GridItem[], _old: GridItem, next: GridItem) =>
    commitRect(next.i, { x: next.x, y: next.y, w: next.w, h: next.h });

  return (
    <main
      ref={ref}
      className="canvas"
      aria-label="Modül alanı"
      style={{
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        backgroundPosition: `${-GRID_SIZE / 2}px ${-GRID_SIZE / 2}px`,
      }}
    >
      {status === "loading" && <p className="canvas-msg muted">Düzen yükleniyor…</p>}
      {status === "error" && (
        <div className="canvas-msg">
          <p>Düzen yüklenemedi.</p>
          <button type="button" onClick={reload}>
            Tekrar dene
          </button>
        </div>
      )}
      {status === "ready" && (
        <>
          {placed.length === 0 && (
            <div className="canvas-msg">
              <p>Henüz modül eklenmedi.</p>
              <p className="muted">Üstteki “Modül ekle/çıkar” düğmesinden modül ekle.</p>
            </div>
          )}
          <GridLayout
            className="layout"
            layout={gridItems}
            cols={cols}
            width={cols * GRID_SIZE}
            rowHeight={GRID_SIZE}
            margin={[0, 0]}
            containerPadding={[0, 0]}
            compactType={null}
            preventCollision
            resizeHandles={["s", "n", "e", "w", "se", "sw", "ne", "nw"]}
            draggableHandle=".module-head"
            draggableCancel=".module-close"
            onDragStop={onStop}
            onResizeStop={onStop}
          >
            {placed.map(({ def }) => (
              <div key={def.id}>
                <ModuleFrame def={def} symbol={selected} onClose={close} />
              </div>
            ))}
          </GridLayout>
        </>
      )}
    </main>
  );
}
