import { useState } from "react";
import type { Candle } from "../api";
import { sma } from "../chart/indicators";
import { compact, fmtTime, nf } from "../format";

const PAD = { top: 8, right: 56, bottom: 20, left: 4 };
const VOL_RATIO = 0.2;
const VOL_GAP = 6;

function path(vals: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  vals.forEach((v, i) => {
    if (v === null) return;
    d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  return d;
}

export interface CandleChartProps {
  candles: Candle[];
  gmtoffset: number;
  period: string;
  w: number;
  h: number;
  /** true ise grafiğin altında hacim çubukları çizilir. */
  volume?: boolean;
}

export function CandleChart({ candles, gmtoffset, period, w, h, volume = false }: CandleChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const n = candles.length;
  const plotW = Math.max(w - PAD.left - PAD.right, 10);
  const plotH = Math.max(h - PAD.top - PAD.bottom, 10);
  const volH = volume ? Math.round(plotH * VOL_RATIO) : 0;
  const priceH = Math.max(plotH - (volume ? volH + VOL_GAP : 0), 10);
  const baseY = PAD.top + plotH; // hacim çubuklarının tabanı
  const step = plotW / n;
  const bodyW = Math.max(1, Math.min(14, step * 0.7));

  const s21 = sma(candles.map((c) => c.c), 21);
  const s50 = sma(candles.map((c) => c.c), 50);

  let lo = Math.min(...candles.map((c) => c.l));
  let hi = Math.max(...candles.map((c) => c.h));
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.05;
  lo -= pad; hi += pad;

  const maxV = volume ? Math.max(0, ...candles.map((c) => c.v || 0)) : 0;

  const x = (i: number) => PAD.left + step * (i + 0.5);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * priceH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);
  const labelIdx = n > 1 ? [0, 0.33, 0.66, 1].map((f) => Math.min(n - 1, Math.round((n - 1) * f))) : [0];
  const hc = hover !== null ? candles[hover] : null;

  return (
    <>
      <div className="chart-info muted" data-testid="chart-info">
        {hc
          ? `${fmtTime(hc.t, gmtoffset, period)} · A ${nf(hc.o)} Y ${nf(hc.h)} D ${nf(hc.l)} K ${nf(hc.c)}${volume ? ` · H ${compact(hc.v || 0)}` : ""}`
          : "Fareyi grafiğin üstüne getir"}
      </div>
      <svg
        role="img"
        aria-label="Mum grafiği"
        width={w}
        height={h}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const i = Math.floor((e.clientX - rect.left - PAD.left) / step);
          setHover(i >= 0 && i < n ? i : null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={w - PAD.right + 4} y={y(t) + 3} className="chart-axis">{nf(t)}</text>
          </g>
        ))}
        {labelIdx.map((i, k) => (
          <text
            key={k}
            x={k === 0 ? PAD.left : k === labelIdx.length - 1 && n > 1 ? w - PAD.right : x(i)}
            y={h - 5}
            textAnchor={k === 0 ? "start" : k === labelIdx.length - 1 && n > 1 ? "end" : "middle"}
            className="chart-axis"
          >
            {fmtTime(candles[i].t, gmtoffset, period)}
          </text>
        ))}
        {volume &&
          candles.map((c, i) => {
            const bh = maxV > 0 ? ((c.v || 0) / maxV) * volH : 0;
            return (
              <rect
                key={c.t}
                data-testid="vol-bar"
                className={c.c >= c.o ? "vol-bar up" : "vol-bar down"}
                x={x(i) - bodyW / 2}
                y={baseY - bh}
                width={bodyW}
                height={bh}
              />
            );
          })}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const top = y(Math.max(c.o, c.c));
          const bodyH = Math.max(1, Math.abs(y(c.o) - y(c.c)));
          return (
            <g key={c.t} className={up ? "candle up" : "candle down"} data-testid="candle">
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} />
              <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={bodyH} />
            </g>
          );
        })}
        <path d={path(s21, x, y)} className="sma sma21" data-testid="sma21" fill="none" />
        <path d={path(s50, x, y)} className="sma sma50" data-testid="sma50" fill="none" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={h - PAD.bottom} className="chart-cross" />}
      </svg>
    </>
  );
}
