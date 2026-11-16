import { useMemo, useState } from "react";
import { SECTORS } from "../data/sectors";
import { SYMBOL_LISTS } from "../data/symbols";
import { compact, nf } from "../format";
import { useQuotes } from "../hooks/useQuotes";
import { useSelection } from "../selection";
import { sectorStats, sortSectors, type SortKey } from "../sector/stats";
import type { ModuleDef } from "./types";

const sign = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}%`;
const tone = (n: number | null) => (n === null || n === 0 ? "flat" : n > 0 ? "up" : "down");

function Sektor() {
  const { quotes, loading, error } = useQuotes(SYMBOL_LISTS.BIST100);
  const { selected, select } = useSelection();
  const [sort, setSort] = useState<SortKey>("pct");
  const [open, setOpen] = useState<string | null>(null);

  const ready = Object.keys(quotes).length > 0;
  const rows = useMemo(() => sortSectors(sectorStats(quotes, SECTORS), sort), [quotes, sort]);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pct ?? 0)));

  if (!ready && loading) return <p className="muted">Yükleniyor…</p>;
  if (!ready) return <p className="muted">{error ?? "Veri yok."}</p>;

  return (
    <div className="sec-card">
      <div className="chart-bar">
        <div role="group" aria-label="Sıralama">
          <button type="button" aria-pressed={sort === "pct"} onClick={() => setSort("pct")}>Değişim</button>
          <button type="button" aria-pressed={sort === "tl"} onClick={() => setSort("tl")}>Hacim (TL)</button>
        </div>
      </div>
      <ul className="sec-list">
        {rows.map((r) => {
          const expanded = open === r.name;
          return (
            <li key={r.name} data-testid="sector-row">
              <button
                type="button"
                className="sec-head"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : r.name)}
              >
                <span className="sec-name">{r.name}</span>
                <span className="sec-bar" aria-hidden="true">
                  {r.pct !== null && (
                    <i
                      className={tone(r.pct)}
                      style={{ width: `${(Math.abs(r.pct) / maxAbs) * 50}%`, [r.pct >= 0 ? "left" : "right"]: "50%" }}
                    />
                  )}
                </span>
                <span className={`price-chg ${tone(r.pct)}`}>{r.pct !== null ? sign(r.pct) : "–"}</span>
                <span className="muted sec-count">{r.counted}/{r.members}</span>
              </button>
              {expanded && (
                <div className="sec-members">
                  <p className="muted">Toplam hacim {compact(r.tl)} TL</p>
                  {r.list.length === 0 && <p className="muted">Bu sektörde veri yok.</p>}
                  {r.list.map((m) => (
                    <button
                      key={m.symbol}
                      type="button"
                      className="sec-member"
                      aria-pressed={selected === m.symbol}
                      onClick={() => select(m.symbol)}
                    >
                      <span>{m.symbol}</span>
                      <span className={`price-chg ${tone(m.pct)}`}>{sign(m.pct)}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted price-foot">
        BIST 100 hisselerinin KAP alt sektörlerine göre TL hacim ağırlıklı ortalama değişimi; resmî sektör endeksi değildir ·
        ~15 dk gecikmeli{error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "sektor",
  title: "Sektör",
  scope: "global",
  defaultSize: { w: 24, h: 28 },
  minSize: { w: 16, h: 12 },
  order: 4,
  component: Sektor,
};

export default def;
