import { useMemo, useRef, useState } from "react";
import { SYMBOL_LISTS, type ListKey } from "../data/symbols";
import { compact, nf } from "../format";
import { heatColor, CAP } from "../heatmap/color";
import { treemap } from "../heatmap/treemap";
import { useQuotes } from "../hooks/useQuotes";
import { useSize } from "../hooks/useSize";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

const TABS: { key: ListKey; label: string }[] = [
  { key: "BIST100", label: "BIST 100" },
  { key: "BIST30", label: "BIST 30" },
];

interface Cell {
  symbol: string;
  pct: number | null;
  tl: number;
  price: number;
}

function IsiHaritasi() {
  const [tab, setTab] = useState<ListKey>("BIST30");
  const symbols = SYMBOL_LISTS[tab];
  const { quotes, failed, loading, error } = useQuotes(symbols);
  const { selected, select } = useSelection();
  const box = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(box);

  // Kutu büyüklüğü = TL hacim (fiyat × gün içi lot). Hacmi/fiyatı olmayan hisse haritaya girmez.
  const { cells, missing } = useMemo(() => {
    const cells: Cell[] = [];
    let missing = 0;
    for (const s of symbols) {
      const q = quotes[s];
      const price = q?.price ?? null;
      const vol = q?.volume ?? null;
      if (price === null || vol === null || price * vol <= 0) {
        missing++;
        continue;
      }
      const prev = q?.prevClose ?? null;
      cells.push({ symbol: s, price, tl: price * vol, pct: prev ? ((price - prev) / prev) * 100 : null });
    }
    return { cells, missing };
  }, [symbols, quotes]);

  const rects = useMemo(() => treemap(cells.map((c) => ({ id: c.symbol, value: c.tl })), w, h), [cells, w, h]);
  const byId = useMemo(() => new Map(cells.map((c) => [c.symbol, c])), [cells]);
  const ready = Object.keys(quotes).length > 0;

  return (
    <div className="chart-wrap">
      <div className="chart-bar">
        <div role="tablist" aria-label="Endeks">
          {TABS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="chart-legend heat-legend">
          <i style={{ background: heatColor(-CAP) }} /> −%{CAP} <i style={{ background: heatColor(0) }} /> 0{" "}
          <i style={{ background: heatColor(CAP) }} /> +%{CAP}
        </span>
      </div>
      <div className="chart-area heat-area" ref={box}>
        {!ready && loading ? (
          <p className="muted">Yükleniyor…</p>
        ) : !ready ? (
          <p className="muted">{error ?? "Veri yok."}</p>
        ) : cells.length === 0 ? (
          <p className="muted">Hacim verisi yok (seans öncesi olabilir).</p>
        ) : (
          rects.map((r) => {
            const c = byId.get(r.id)!;
            const pctText = c.pct === null ? "–" : `${c.pct > 0 ? "+" : ""}${nf(c.pct)}%`;
            return (
              <button
                key={r.id}
                type="button"
                data-testid="heat-cell"
                className="heat-cell"
                aria-pressed={selected === r.id}
                aria-label={`${r.id} ${pctText}`}
                title={`${r.id} · ${nf(c.price)} · ${pctText} · ${compact(c.tl)} TL`}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, background: heatColor(c.pct) }}
                onClick={() => select(r.id)}
              >
                {r.w >= 34 && r.h >= 18 && <span className="heat-sym">{r.id}</span>}
                {r.w >= 46 && r.h >= 34 && <span className="heat-pct">{pctText}</span>}
              </button>
            );
          })
        )}
      </div>
      <p className="muted price-foot">
        Kutu büyüklüğü = TL hacim (fiyat × lot), renk = günlük değişim · ~15 dk gecikmeli
        {missing > 0 && ready ? ` · ${missing} hissede veri yok` : ""}
        {failed.length > 0 ? ` (${failed.length} fiyat alınamadı)` : ""}
        {error && ready ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "isi-haritasi",
  title: "Isı haritası",
  scope: "global",
  defaultSize: { w: 44, h: 26 },
  minSize: { w: 24, h: 14 },
  order: 3,
  component: IsiHaritasi,
};

export default def;
