import { useMemo, useState } from "react";
import { SYMBOL_LISTS } from "../data/symbols";
import { nf } from "../format";
import { useStats } from "../hooks/useStats";
import { GROUPS, applyFilters } from "../screener/filters";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

const UNIVERSES = [
  { key: "BIST100", label: "BIST 100" },
  { key: "BIST30", label: "BIST 30" },
] as const;
type UniverseKey = (typeof UNIVERSES)[number]["key"];

function Tarayici() {
  const [universe, setUniverse] = useState<UniverseKey>("BIST100");
  const [sel, setSel] = useState<Record<string, string>>({});
  const symbols = SYMBOL_LISTS[universe];
  const { stats, loading, error } = useStats(symbols);
  const { selected, select } = useSelection();

  const rows = useMemo(() => applyFilters(stats, sel), [stats, sel]);
  const anyFilter = Object.values(sel).some(Boolean);

  return (
    <div className="scr-card">
      <div className="scr-filters">
        <label className="scr-field">
          <span>Liste</span>
          <select value={universe} onChange={(e) => setUniverse(e.target.value as UniverseKey)}>
            {UNIVERSES.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        {GROUPS.map((g) => (
          <label key={g.key} className="scr-field">
            <span>{g.label}</span>
            <select value={sel[g.key] ?? ""} onChange={(e) => setSel((s) => ({ ...s, [g.key]: e.target.value }))}>
              <option value="">Fark etmez</option>
              {g.options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="scr-bar">
        <span data-testid="tr-count" className="muted">
          {stats.length > 0 ? `${rows.length} / ${stats.length} hisse` : ""}
        </span>
        <button type="button" disabled={!anyFilter} onClick={() => setSel({})}>
          Filtreleri temizle
        </button>
      </div>

      {stats.length === 0 ? (
        <p className="muted">{loading ? "Yükleniyor…" : (error ?? "Veri yok.")}</p>
      ) : rows.length === 0 ? (
        <p className="muted">Eşleşen hisse yok.</p>
      ) : (
        <div className="scr-results">
          <table className="mv-table">
            <thead>
              <tr className="muted">
                <th align="left">Hisse</th>
                <th className="mv-num">Fiyat</th>
                <th className="mv-num">Değişim</th>
                <th className="mv-num">RSI</th>
                <th className="mv-num">Hacim</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol} aria-selected={selected === r.symbol}>
                  <td>
                    <button type="button" className="mv-sym" data-testid="tr-sym" onClick={() => select(r.symbol)}>
                      {r.symbol}
                    </button>
                  </td>
                  <td className="mv-num" data-testid="tr-price">{nf(r.price)}</td>
                  <td
                    className={`mv-num ${r.pct === null ? "" : r.pct > 0 ? "up" : r.pct < 0 ? "down" : ""}`}
                    data-testid="tr-pct"
                  >
                    {r.pct === null ? "–" : `${r.pct > 0 ? "+" : ""}${nf(r.pct)}%`}
                  </td>
                  <td className="mv-num" data-testid="tr-rsi">{r.rsi === null ? "–" : nf(r.rsi, 0)}</td>
                  <td className="mv-num muted" data-testid="tr-ratio">{r.ratio === null ? "–" : `${nf(r.ratio, 1)}×`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted price-foot">
        Günlük mumlardan (~3 ay) hesaplanır, ~15 dk gecikmeli. Filtreler VE ile birleşir; eksik veri filtreyi geçemez.
        Tarama sonucu yatırım tavsiyesi değildir{error && stats.length > 0 ? " · Güncellenemedi" : ""}.
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "tarayici",
  title: "Tarayıcı (screener)",
  scope: "global",
  defaultSize: { w: 28, h: 30 },
  minSize: { w: 20, h: 20 },
  order: 65,
  component: Tarayici,
};

export default def;
