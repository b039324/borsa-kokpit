import { useMemo, useState } from "react";
import { LineChart } from "../components/LineChart";
import { alignAsOf, rebase, totalReturn } from "../compare/series";
import { pct } from "../format";
import { useChart } from "../hooks/useChart";
import type { ModuleDef, ModuleProps } from "./types";

const PERIODS = [
  { key: "3a", label: "3 ay" },
  { key: "6a", label: "6 ay" },
  { key: "1y", label: "1 yıl" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const BENCHES = [
  { key: "USDTRY", label: "USD/TRY" },
  { key: "XU100", label: "BIST 100" },
  { key: "GOLD", label: "Altın (ons, USD)" },
  { key: "BRENT", label: "Brent petrol (USD)" },
];

const tone = (v: number | null) => (v === null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");

function Karsilastirma({ symbol }: ModuleProps) {
  const [period, setPeriod] = useState<PeriodKey>("6a");
  const [benchKey, setBenchKey] = useState("USDTRY");
  const stock = useChart(symbol, period);
  const bench = useChart(benchKey, period);
  const benchLabel = BENCHES.find((b) => b.key === benchKey)?.label ?? benchKey;

  const pairs = useMemo(
    () =>
      stock.data && bench.data
        ? alignAsOf(stock.data.candles, stock.data.gmtoffset, bench.data.candles, bench.data.gmtoffset)
        : [],
    [stock.data, bench.data],
  );
  const a = useMemo(() => rebase(pairs.map((p) => p.a)), [pairs]);
  const b = useMemo(() => rebase(pairs.map((p) => p.b)), [pairs]);

  const head = (
    <div className="chart-bar">
      <div role="group" aria-label="Dönem">
        {PERIODS.map((p) => (
          <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="cmp-pick">
        <span className="muted">Karşılaştırılacak</span>{" "}
        <select value={benchKey} onChange={(e) => setBenchKey(e.target.value)}>
          {BENCHES.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
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
  if (a.length < 2 || b.length < 2) {
    return (
      <div className="chart-wrap">
        {head}
        <p className="muted">Karşılaştırılacak ortak veri yok.</p>
      </div>
    );
  }

  const sRet = totalReturn(a);
  const bRet = totalReturn(b);
  return (
    <div className="chart-wrap">
      {head}
      <LineChart
        label={`${symbol} ve ${benchLabel} (başlangıç = 100)`}
        baseline={100}
        series={[
          { name: "hisse", values: a, className: "cmp-stock" },
          { name: "kıyas", values: b, className: "cmp-bench" },
        ]}
      />
      <dl className="price-grid">
        <dt className="cmp-key-stock">{symbol}</dt>
        <dd className={tone(sRet)} data-testid="cmp-stock">{sRet === null ? "–" : pct(sRet, true)}</dd>
        <dt className="cmp-key-bench">{benchLabel}</dt>
        <dd className={tone(bRet)} data-testid="cmp-bench">{bRet === null ? "–" : pct(bRet, true)}</dd>
      </dl>
      <p className="muted price-foot">Her iki seri başlangıçta 100'e çekilir; kapanışlara göre, ortak günlerde.</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "karsilastirma",
  title: "Karşılaştırma (dolar, endeks, altın…)",
  scope: "stock",
  defaultSize: { w: 24, h: 22 },
  minSize: { w: 18, h: 16 },
  order: 48,
  component: Karsilastirma,
};

export default def;
