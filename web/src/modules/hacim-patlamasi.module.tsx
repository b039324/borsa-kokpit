import { useMemo } from "react";
import { SYMBOL_LISTS } from "../data/symbols";
import { compact, nf } from "../format";
import { useStats } from "../hooks/useStats";
import { volumeSpikes } from "../market/statsRank";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

const SYMBOLS = SYMBOL_LISTS.BIST100;
const MIN_RATIO = 2;

function HacimPatlamasi() {
  const { stats, loading, error } = useStats(SYMBOLS);
  const { selected, select } = useSelection();
  const rows = useMemo(() => volumeSpikes(stats, MIN_RATIO), [stats]);

  if (stats.length === 0) return <p className="muted">{loading ? "Yükleniyor…" : (error ?? "Veri yok.")}</p>;

  return (
    <div className="chart-wrap">
      {rows.length === 0 ? (
        <p className="muted">Şu an hacmi ortalamasının {MIN_RATIO} katını aşan hisse yok.</p>
      ) : (
        <table className="mv-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} aria-selected={selected === r.symbol}>
                <td>
                  <button type="button" className="mv-sym" data-testid="hp-sym" onClick={() => select(r.symbol)}>
                    {r.symbol}
                  </button>
                </td>
                <td className="mv-num" data-testid="hp-ratio">{nf(r.ratio, 1)}×</td>
                <td className="mv-num muted" data-testid="hp-vol">{compact(r.volume)}</td>
                <td
                  className={`mv-num ${r.pct === null ? "" : r.pct > 0 ? "up" : r.pct < 0 ? "down" : ""}`}
                  data-testid="hp-pct"
                >
                  {r.pct === null ? "–" : `${r.pct > 0 ? "+" : ""}${nf(r.pct)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted price-foot">
        Oran = son seans lotu ÷ önceki 20 seansın ortalaması. Gün içinde oranlar seans ilerledikçe yükselir; sabah düşük
        görünmesi normaldir. BIST 100 · ~15 dk gecikmeli{error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "hacim-patlamasi",
  title: "Hacim patlaması",
  scope: "global",
  defaultSize: { w: 18, h: 16 },
  minSize: { w: 14, h: 12 },
  order: 63,
  component: HacimPatlamasi,
};

export default def;
