import { useMemo, useState } from "react";
import { SYMBOL_LISTS } from "../data/symbols";
import { compact, nf } from "../format";
import { useQuotes } from "../hooks/useQuotes";
import { rankRows, topGainers, topLosers, topVolume } from "../market/movers";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

type Tab = "up" | "down" | "vol";
const TABS: { key: Tab; label: string }[] = [
  { key: "up", label: "Yükselen" },
  { key: "down", label: "Düşen" },
  { key: "vol", label: "Hacimli" },
];
const N = 5;
const SYMBOLS = SYMBOL_LISTS.BIST100;

function EnCokHareket() {
  const [tab, setTab] = useState<Tab>("up");
  const { quotes, loading, error } = useQuotes(SYMBOLS);
  const { selected, select } = useSelection();

  const rows = useMemo(() => rankRows(SYMBOLS, quotes), [quotes]);
  const list = useMemo(
    () => (tab === "up" ? topGainers(rows, N) : tab === "down" ? topLosers(rows, N) : topVolume(rows, N)),
    [rows, tab],
  );

  return (
    <div className="chart-wrap">
      <div className="chart-bar">
        <div role="tablist" aria-label="Sıralama">
          {TABS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="muted">BIST 100</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{loading ? "Yükleniyor…" : (error ?? "Veri yok.")}</p>
      ) : list.length === 0 ? (
        <p className="muted">Bu sıralama için veri yok (seans öncesi olabilir).</p>
      ) : (
        <table className="mv-table">
          <tbody>
            {list.map((r, i) => (
              <tr key={r.symbol} aria-selected={selected === r.symbol}>
                <td className="muted">{i + 1}</td>
                <td>
                  <button type="button" className="mv-sym" data-testid="mv-sym" onClick={() => select(r.symbol)}>
                    {r.symbol}
                  </button>
                </td>
                <td className="mv-num">{nf(r.price)}</td>
                <td
                  className={`mv-num ${r.pct === null ? "" : r.pct > 0 ? "up" : r.pct < 0 ? "down" : ""}`}
                  data-testid="mv-pct"
                >
                  {r.pct === null ? "–" : `${r.pct > 0 ? "+" : ""}${nf(r.pct)}%`}
                </td>
                {tab === "vol" && (
                  <td className="mv-num muted" data-testid="mv-tl">
                    {compact(r.tl)} TL
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted price-foot">
        İlk {N} · ~15 dk gecikmeli · hacim = fiyat × gün içi lot{error && rows.length > 0 ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "en-cok-hareket",
  title: "En çok yükselen / düşen / hacimli",
  scope: "global",
  defaultSize: { w: 18, h: 16 },
  minSize: { w: 14, h: 12 },
  order: 60,
  component: EnCokHareket,
};

export default def;
