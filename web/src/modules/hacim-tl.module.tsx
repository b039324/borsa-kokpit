import { useRef, useState } from "react";
import type { Candle } from "../api";
import { PeriodBar } from "../components/PeriodBar";
import { compact, fmtTime, nf } from "../format";
import { useChart } from "../hooks/useChart";
import { useSize } from "../hooks/useSize";
import { tlOf, volumeStats } from "../volume/stats";
import type { ModuleDef, ModuleProps } from "./types";

const PAD = { top: 6, right: 56, bottom: 18, left: 4 };

function Bars({ candles, gmtoffset, period, w, h }: { candles: Candle[]; gmtoffset: number; period: string; w: number; h: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = candles.length;
  const plotW = Math.max(w - PAD.left - PAD.right, 10);
  const plotH = Math.max(h - PAD.top - PAD.bottom, 10);
  const step = plotW / n;
  const bw = Math.max(1, step * 0.8);
  const tls = candles.map(tlOf);
  const max = Math.max(...tls, 1);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const hc = hover !== null ? candles[hover] : null;

  return (
    <>
      <div className="chart-info muted" data-testid="vol-info">
        {hc
          ? `${fmtTime(hc.t, gmtoffset, period)} · ${compact(tlOf(hc))} TL · ${compact(hc.v)} lot`
          : "Fareyi çubukların üstüne getir"}
      </div>
      <svg
        role="img"
        aria-label="Hacim TL grafiği"
        width={w}
        height={h}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const i = Math.floor((e.clientX - rect.left - PAD.left) / step);
          setHover(i >= 0 && i < n ? i : null);
        }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(max * f)} y2={y(max * f)} className="chart-grid" />
            <text x={w - PAD.right + 4} y={y(max * f) + 3} className="chart-axis">{compact(max * f)}</text>
          </g>
        ))}
        {candles.map((c, i) => (
          <rect
            key={c.t}
            data-testid="vol-bar"
            className={c.c >= c.o ? "vol-bar up" : "vol-bar down"}
            x={PAD.left + step * i + (step - bw) / 2}
            y={y(tls[i])}
            width={bw}
            height={Math.max(0, PAD.top + plotH - y(tls[i]))}
          />
        ))}
        <text x={PAD.left} y={h - 4} className="chart-axis">{fmtTime(candles[0].t, gmtoffset, period)}</text>
        <text x={w - PAD.right} y={h - 4} textAnchor="end" className="chart-axis">
          {fmtTime(candles[n - 1].t, gmtoffset, period)}
        </text>
      </svg>
    </>
  );
}

function HacimTL({ symbol }: ModuleProps) {
  const [period, setPeriod] = useState("1g");
  const chart = useChart(symbol, period);
  const intraday = useChart(symbol, "1g");
  const daily = useChart(symbol, "3a");
  const box = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(box);

  const stats = intraday.data && daily.data ? volumeStats(intraday.data.candles, daily.data.candles) : null;
  const data = chart.data;

  return (
    <div className="chart-wrap">
      <div className="vol-stats">
        {stats ? (
          <>
            <div>
              <div className="muted">Bugün (TL)</div>
              <strong data-testid="vol-today">{compact(stats.todayTL)}</strong>
            </div>
            <div>
              <div className="muted">20 gün ort. (TL)</div>
              <strong data-testid="vol-avg">{stats.avgDailyTL !== null ? compact(stats.avgDailyTL) : "–"}</strong>
            </div>
            <div>
              <div className="muted">Oran</div>
              <strong data-testid="vol-ratio">{stats.ratio !== null ? `${nf(stats.ratio, 2)}x` : "–"}</strong>
            </div>
          </>
        ) : (
          <span className="muted">{intraday.error ?? daily.error ?? "Özet yükleniyor…"}</span>
        )}
      </div>
      <div className="chart-bar">
        <PeriodBar value={period} onChange={setPeriod} />
        <span className="chart-legend">TL ≈ kapanış × lot</span>
      </div>
      <div className="chart-area" ref={box}>
        {chart.loading && !data ? (
          <p className="muted">Yükleniyor…</p>
        ) : !data ? (
          <p className="muted">{chart.error ?? "Veri yok."}</p>
        ) : data.candles.length === 0 ? (
          <p className="muted">Bu dönem için mum verisi yok.</p>
        ) : (
          <Bars candles={data.candles} gmtoffset={data.gmtoffset} period={period} w={w} h={h} />
        )}
      </div>
      {stats && stats.ratio !== null && intraday.data && (
        <p className="muted price-foot">
          Oran, bugünkü hacmin son {stats.days} günlük ortalamaya bölümüdür; seans sürerken gün tamamlanmadığı için düşük çıkması normaldir.
        </p>
      )}
    </div>
  );
}

const def: ModuleDef = {
  id: "hacim-tl",
  title: "Hacim (TL)",
  scope: "stock",
  defaultSize: { w: 28, h: 18 },
  minSize: { w: 16, h: 11 },
  order: 15,
  component: HacimTL,
};

export default def;
