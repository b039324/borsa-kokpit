import { useMemo, useState } from "react";
import { SYMBOL_LISTS } from "../data/symbols";
import { nf } from "../format";
import { useStats } from "../hooks/useStats";
import { useSelection } from "../selection";
import type { Verdict } from "../signal/signal";
import { signalFromStats } from "../signal/stats-signal";
import type { ModuleDef } from "./types";

const UNIVERSES = [
  { key: "BIST100", label: "BIST 100" },
  { key: "BIST30", label: "BIST 30" },
] as const;
type UniverseKey = (typeof UNIVERSES)[number]["key"];

const FILTERS = ["Hepsi", "AL", "TUT", "SAT"] as const;
type Filter = (typeof FILTERS)[number];

const TONE: Record<Verdict, "up" | "down" | "flat"> = { AL: "up", SAT: "down", TUT: "flat", YETERSİZ: "flat" };
const RANK: Record<Verdict, number> = { AL: 0, TUT: 1, YETERSİZ: 2, SAT: 3 };

function SinyalListesi() {
  const [universe, setUniverse] = useState<UniverseKey>("BIST100");
  const [filter, setFilter] = useState<Filter>("Hepsi");
  const { stats, loading, error } = useStats(SYMBOL_LISTS[universe]);
  const { selected, select } = useSelection();

  const all = useMemo(
    () =>
      stats
        .map((s) => ({ s, sig: signalFromStats(s) }))
        // AL önce, sonra TUT, en altta SAT; aynı kararda skora göre azalan, eşitse kod sırası.
        .sort((a, b) => RANK[a.sig.verdict] - RANK[b.sig.verdict] || b.sig.score - a.sig.score || a.s.symbol.localeCompare(b.s.symbol)),
    [stats],
  );
  const count = (v: Verdict) => all.filter((r) => r.sig.verdict === v).length;
  const rows = filter === "Hepsi" ? all : all.filter((r) => r.sig.verdict === filter);

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
        <div className="sl-filter" role="group" aria-label="Karar filtresi">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="scr-bar">
        <span data-testid="sl-summary" className="muted">
          {all.length > 0 ? `AL ${count("AL")} · TUT ${count("TUT")} · SAT ${count("SAT")} · ${all.length} hisse` : ""}
        </span>
      </div>
      {all.length === 0 ? (
        <p className="muted">{loading ? "Yükleniyor…" : (error ?? "Veri yok.")}</p>
      ) : rows.length === 0 ? (
        <p className="muted">Bu karara uyan hisse yok.</p>
      ) : (
        <div className="scr-results">
          <table className="mv-table">
            <thead>
              <tr className="muted">
                <th align="left">Hisse</th>
                <th className="mv-num">Fiyat</th>
                <th className="mv-num">Skor</th>
                <th className="mv-num">Karar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, sig }) => (
                <tr key={s.symbol} aria-selected={selected === s.symbol}>
                  <td>
                    <button type="button" className="mv-sym" data-testid="sl-sym" onClick={() => select(s.symbol)}>
                      {s.symbol}
                    </button>
                  </td>
                  <td className="mv-num">{s.price === null ? "–" : nf(s.price)}</td>
                  <td className="mv-num muted" data-testid="sl-score" title={`${sig.voters} gösterge oy verdi`}>
                    {sig.voters < 2 ? "–" : `${sig.score > 0 ? "+" : ""}${sig.score}`}
                  </td>
                  <td className={`mv-num ${TONE[sig.verdict]}`} data-testid="sl-verdict">
                    {sig.verdict}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted price-foot">
        Yaklaşık sinyal: günlük özetten SMA 20/50 trendi, fiyat/SMA 20 ve RSI ile hesaplanır (MACD yok); tek hisse sinyalinden
        küçük farklar olabilir. ~15 dk gecikmeli, bilgi amaçlıdır, yatırım tavsiyesi değildir{error && stats.length > 0 ? " · Güncellenemedi" : ""}.
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "sinyal-listesi",
  title: "Sinyal listesi (BIST 100 tarama)",
  scope: "global",
  defaultSize: { w: 26, h: 30 },
  minSize: { w: 18, h: 18 },
  order: 21,
  component: SinyalListesi,
};

export default def;
