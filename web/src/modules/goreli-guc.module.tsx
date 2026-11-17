import { useMemo, useState } from "react";
import { LineChart } from "../components/LineChart";
import { alignAsOf, ratioSeries, totalReturn } from "../compare/series";
import { nf, pct } from "../format";
import { useChart } from "../hooks/useChart";
import type { ModuleDef, ModuleProps } from "./types";

const PERIODS = [
  { key: "3a", label: "3 ay" },
  { key: "6a", label: "6 ay" },
  { key: "1y", label: "1 yıl" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const tone = (v: number | null) => (v === null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");

function GoreliGuc({ symbol }: ModuleProps) {
  const [period, setPeriod] = useState<PeriodKey>("6a");
  const stock = useChart(symbol, period);
  const bench = useChart("XU100", period);

  const pairs = useMemo(
    () =>
      stock.data && bench.data
        ? alignAsOf(stock.data.candles, stock.data.gmtoffset, bench.data.candles, bench.data.gmtoffset)
        : [],
    [stock.data, bench.data],
  );
  const ratio = useMemo(() => ratioSeries(pairs), [pairs]);

  const head = (
    <div className="chart-bar">
      <div role="group" aria-label="Dönem">
        {PERIODS.map((p) => (
          <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <span className="muted">{symbol} / BIST 100</span>
    </div>
  );

  if (!stock.data || !bench.data) {
    const loading = stock.loading || bench.loading;
    return (
      <div className="chart-wrap">
        {head}
        <p className="muted">{loading ? "Yükleniyor…" : (stock.error ?? bench.error ?? "Veri yok.")}</p>
      </div>
    );
  }
  if (pairs.length < 2 || ratio.length < 2) {
    return (
      <div className="chart-wrap">
        {head}
        <p className="muted">Karşılaştırılacak ortak veri yok.</p>
      </div>
    );
  }

  const sRet = totalReturn(pairs.map((p) => p.a));
  const bRet = totalReturn(pairs.map((p) => p.b));
  const diff = sRet !== null && bRet !== null ? (sRet - bRet) * 100 : null;
  const ahead = ratio[ratio.length - 1] >= 100;

  return (
    <div className="chart-wrap">
      {head}
      <LineChart
        label="Hisse / BIST 100 oranı (başlangıç = 100)"
        baseline={100}
        series={[{ name: "oran", values: ratio, className: "rs" }]}
      />
      <dl className="price-grid">
        <dt>{symbol}</dt>
        <dd className={tone(sRet)} data-testid="rs-stock">{sRet === null ? "–" : pct(sRet, true)}</dd>
        <dt>BIST 100</dt>
        <dd className={tone(bRet)} data-testid="rs-bench">{bRet === null ? "–" : pct(bRet, true)}</dd>
        <dt>Fark</dt>
        <dd className={tone(diff)} data-testid="rs-diff">
          {diff === null ? "–" : `${diff > 0 ? "+" : ""}${nf(diff)} puan`}
        </dd>
        <dt>Yorum</dt>
        <dd data-testid="rs-verdict">{ahead ? "Endeksi geçiyor" : "Endeksin gerisinde"}</dd>
      </dl>
      <p className="muted price-foot">Çizgi yükseliyorsa hisse endeksten güçlü; 100'ün altı endeksin gerisi demektir.</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "goreli-guc",
  title: "Göreli güç (BIST 100'e karşı)",
  scope: "stock",
  defaultSize: { w: 22, h: 20 },
  minSize: { w: 16, h: 16 },
  order: 47,
  component: GoreliGuc,
};

export default def;
