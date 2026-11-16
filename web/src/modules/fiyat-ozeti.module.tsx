import { compact, nf } from "../format";
import { useChart } from "../hooks/useChart";
import type { ModuleDef, ModuleProps } from "./types";

function clock(t: number, gmtoffset: number): string {
  const d = new Date((t + gmtoffset) * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function FiyatOzeti({ symbol }: ModuleProps) {
  const { data, loading, error, marketOpen } = useChart(symbol, "1g");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const candles = data.candles;
  const last = candles[candles.length - 1];
  const price = data.price ?? last?.c ?? null;
  if (price === null) return <p className="muted">Bu hisse için bugün veri yok.</p>;

  const prev = data.prevClose;
  const diff = prev ? price - prev : null;
  const pct = prev ? (diff! / prev) * 100 : null;
  const dir = diff === null || diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  const high = candles.length ? Math.max(...candles.map((c) => c.h)) : null;
  const low = candles.length ? Math.min(...candles.map((c) => c.l)) : null;
  const lot = candles.reduce((s, c) => s + c.v, 0);
  const tl = candles.reduce((s, c) => s + c.c * c.v, 0); // yaklaşık: mum kapanışı × lot

  return (
    <div className="price-card">
      <div className="price-main">
        <span className="price-last">{nf(price)}</span>
        <span className="muted"> {data.currency ?? "TRY"}</span>
        {diff !== null && pct !== null && (
          <span className={`price-chg ${dir}`}>
            {diff > 0 ? "+" : ""}
            {nf(diff)} ({pct > 0 ? "+" : ""}
            {nf(pct)}%)
          </span>
        )}
      </div>
      <dl className="price-grid">
        <dt>Önceki kapanış</dt>
        <dd>{prev ? nf(prev) : "–"}</dd>
        <dt>Gün en yüksek</dt>
        <dd>{high !== null ? nf(high) : "–"}</dd>
        <dt>Gün en düşük</dt>
        <dd>{low !== null ? nf(low) : "–"}</dd>
        <dt>Hacim (lot)</dt>
        <dd>{compact(lot)}</dd>
        <dt>Hacim (TL, yaklaşık)</dt>
        <dd>{compact(tl)}</dd>
      </dl>
      <p className="muted price-foot">
        {last ? `Son mum ${clock(last.t, data.gmtoffset)} · ` : ""}
        ~15 dk gecikmeli · {marketOpen ? "15 sn'de bir yenilenir" : "Seans kapalı"}
        {error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "fiyat-ozeti",
  title: "Fiyat özeti",
  scope: "stock",
  defaultSize: { w: 16, h: 11 },
  minSize: { w: 10, h: 8 },
  order: 10,
  component: FiyatOzeti,
};

export default def;
