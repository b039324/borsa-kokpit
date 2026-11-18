import { useRef, useState } from "react";
import { CandleChart } from "../components/CandleChart";
import { PeriodBar } from "../components/PeriodBar";
import { fmtTime } from "../format";
import { useChart } from "../hooks/useChart";
import { useSize } from "../hooks/useSize";
import type { ModuleDef, ModuleProps } from "./types";

export { fmtTime };

function Grafik({ symbol }: ModuleProps) {
  const [period, setPeriod] = useState<string>("1g");
  const { data, loading, error } = useChart(symbol, period);
  const box = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(box);

  return (
    <div className="chart-wrap">
      <div className="chart-bar">
        <PeriodBar value={period} onChange={setPeriod} />
        <span className="chart-legend">
          <i className="sma21" /> SMA 21 <i className="sma50" /> SMA 50
        </span>
      </div>
      <div className="chart-area" ref={box}>
        {loading && !data ? (
          <p className="muted">Yükleniyor…</p>
        ) : !data ? (
          <p className="muted">{error ?? "Veri yok."}</p>
        ) : data.candles.length === 0 ? (
          <p className="muted">Bu dönem için mum verisi yok.</p>
        ) : (
          <CandleChart candles={data.candles} gmtoffset={data.gmtoffset} period={period} w={w} h={h} volume />
        )}
      </div>
      {data && error && <p className="muted">Güncellenemedi</p>}
    </div>
  );
}

const def: ModuleDef = {
  id: "grafik",
  title: "Grafik",
  scope: "stock",
  defaultSize: { w: 36, h: 20 },
  minSize: { w: 18, h: 12 },
  order: 5,
  component: Grafik,
};

export default def;
