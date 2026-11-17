import { useMemo, useState } from "react";
import { SYMBOL_LISTS } from "../data/symbols";
import { pct } from "../format";
import { useStats } from "../hooks/useStats";
import { rankByVol } from "../market/statsRank";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

const SYMBOLS = SYMBOL_LISTS.BIST100;
const N = 8;

function VolatiliteSiralamasi() {
  const [dir, setDir] = useState<"high" | "low">("high");
  const { stats, loading, error } = useStats(SYMBOLS);
  const { selected, select } = useSelection();
  const rows = useMemo(() => rankByVol(stats, dir, N), [stats, dir]);

  return (
    <div className="chart-wrap">
      <div className="chart-bar">
        <div role="tablist" aria-label="Sıralama">
          <button role="tab" type="button" aria-selected={dir === "high"} onClick={() => setDir("high")}>
            En oynak
          </button>
          <button role="tab" type="button" aria-selected={dir === "low"} onClick={() => setDir("low")}>
            En sakin
          </button>
        </div>
        <span className="muted">BIST 100</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{loading ? "Yükleniyor…" : (error ?? "Veri yok.")}</p>
      ) : (
        <table className="mv-table">
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.symbol} aria-selected={selected === r.symbol}>
                <td className="muted">{i + 1}</td>
                <td>
                  <button type="button" className="mv-sym" data-testid="vs-sym" onClick={() => select(r.symbol)}>
                    {r.symbol}
                  </button>
                </td>
                <td className="mv-num" data-testid="vs-vol">{pct(r.vol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted price-foot">
        Yıllıklandırılmış oynaklık: son ~60 günlük günlük getirilerin standart sapması × √252. Geçmiş davranıştır,
        yatırım tavsiyesi değildir{error && rows.length > 0 ? " · Güncellenemedi" : ""}.
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "volatilite-siralamasi",
  title: "Volatilite sıralaması",
  scope: "global",
  defaultSize: { w: 18, h: 18 },
  minSize: { w: 14, h: 14 },
  order: 64,
  component: VolatiliteSiralamasi,
};

export default def;
