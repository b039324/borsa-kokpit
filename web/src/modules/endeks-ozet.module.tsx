import { nf } from "../format";
import { useMarket } from "../hooks/useMarket";
import type { ModuleDef } from "./types";

function EndeksOzet() {
  const { items, loading, error } = useMarket();

  if (loading && items.length === 0) return <p className="muted">Yükleniyor…</p>;
  if (items.length === 0) return <p className="muted">{error ?? "Veri yok."}</p>;

  return (
    <div className="mkt-card">
      <div className="mkt-grid">
        {items.map((it) => {
          const pct = it.price !== null && it.prevClose ? ((it.price - it.prevClose) / it.prevClose) * 100 : null;
          const tone = pct === null || pct === 0 ? "flat" : pct > 0 ? "up" : "down";
          return (
            <div key={it.key} className="mkt-item" data-testid={`mkt-${it.key}`}>
              <div className="muted mkt-label">{it.label}</div>
              <div className="mkt-price">{it.price !== null ? nf(it.price, it.decimals) : "–"}</div>
              <div className={`price-chg ${tone}`}>{pct !== null ? `${pct > 0 ? "+" : ""}${nf(pct)}%` : "–"}</div>
            </div>
          );
        })}
      </div>
      <p className="muted price-foot">
        Yahoo verisi, ~15 dk gecikmeli olabilir · BIST seansında 15 sn'de bir yenilenir
        {error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "endeks-ozet",
  title: "Endeks / piyasa özeti",
  scope: "global",
  defaultSize: { w: 28, h: 12 },
  minSize: { w: 16, h: 8 },
  order: 2,
  component: EndeksOzet,
};

export default def;
