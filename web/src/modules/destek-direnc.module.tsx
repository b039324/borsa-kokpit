import { nf } from "../format";
import { useChart } from "../hooks/useChart";
import { pickPrevDay, pivotLevels, swingLevels } from "../levels/pivot";
import type { ModuleDef, ModuleProps } from "./types";

const SWING_BARS = 60; // son ~3 aylık günlük mum

function DestekDirenc({ symbol }: ModuleProps) {
  const { data, loading, error } = useChart(symbol, "3a");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const prev = pickPrevDay(data.candles, data.gmtoffset, Date.now());
  const last = data.candles[data.candles.length - 1];
  const price = data.price ?? last?.c ?? null;
  if (!prev || price === null) return <p className="muted">Hesap için yeterli veri yok.</p>;

  const pv = pivotLevels(prev.h, prev.l, prev.c);
  const sw = swingLevels(data.candles.slice(-SWING_BARS), price);
  const rows: [string, string, number][] = [
    ["R3", "r3", pv.r3],
    ["R2", "r2", pv.r2],
    ["R1", "r1", pv.r1],
    ["Pivot", "p", pv.p],
    ["S1", "s1", pv.s1],
    ["S2", "s2", pv.s2],
    ["S3", "s3", pv.s3],
  ];

  return (
    <div className="levels-card">
      <dl className="price-grid">
        {rows.map(([label, key, v]) => (
          <div key={key} className={`lvl-row ${key.startsWith("r") ? "down" : key.startsWith("s") ? "up" : ""}`} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd data-testid={`lvl-${key}`}>{nf(v)}</dd>
          </div>
        ))}
      </dl>
      <dl className="price-grid">
        <dt>Yakın direnç (tepe)</dt>
        <dd data-testid="swing-resistance">{sw.resistance !== null ? nf(sw.resistance) : "–"}</dd>
        <dt>Yakın destek (dip)</dt>
        <dd data-testid="swing-support">{sw.support !== null ? nf(sw.support) : "–"}</dd>
      </dl>
      <p className="muted price-foot">
        Güncel {nf(price)} · Klasik pivot, önceki günün yüksek/düşük/kapanışından; tepe/dip son {SWING_BARS} günlük mumdan.
        Bilgi amaçlıdır, yatırım tavsiyesi değildir.
        {error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "destek-direnc",
  title: "Destek / direnç / pivot",
  scope: "stock",
  defaultSize: { w: 16, h: 16 },
  minSize: { w: 12, h: 12 },
  order: 40,
  component: DestekDirenc,
};

export default def;
