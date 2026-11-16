import type { Candle } from "../api";

export type RiskLevel = "düşük" | "orta" | "yüksek";

export interface RiskStats {
  n: number; // getiri sayısı
  vol: number; // yıllıklandırılmış oynaklık (oran)
  level: RiskLevel;
  maxDrawdown: number; // ≤ 0
  currentDrawdown: number; // ≤ 0
  worst: { ret: number; t: number };
  best: { ret: number; t: number };
  var95: number; // tarihsel %95 günlük VaR (negatif getiri)
  upRatio: number; // yükselen gün oranı
}

const MIN_CANDLES = 10;
const TRADING_DAYS = 252;

export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(closes[i] / closes[i - 1] - 1);
  return out;
}

// Örnek standart sapma (n-1)
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export const annualizedVol = (returns: number[]): number => stdev(returns) * Math.sqrt(TRADING_DAYS);

export function maxDrawdown(closes: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    worst = Math.min(worst, c / peak - 1);
  }
  return worst;
}

export function currentDrawdown(closes: number[]): number {
  if (closes.length === 0) return 0;
  return closes[closes.length - 1] / Math.max(...closes) - 1;
}

// Kaba sınıflama (BIST hisseleri için); eşikler yaklaşıktır.
export function riskLevel(vol: number): RiskLevel {
  return vol < 0.25 ? "düşük" : vol < 0.45 ? "orta" : "yüksek";
}

export function riskStats(candles: Candle[]): RiskStats | null {
  if (candles.length < MIN_CANDLES) return null;
  const closes = candles.map((c) => c.c);
  const rets = dailyReturns(closes);
  const withT = rets.map((ret, i) => ({ ret, t: candles[i + 1].t }));
  const worst = withT.reduce((a, b) => (b.ret < a.ret ? b : a));
  const best = withT.reduce((a, b) => (b.ret > a.ret ? b : a));
  const sorted = [...rets].sort((a, b) => a - b);
  const vol = annualizedVol(rets);
  return {
    n: rets.length,
    vol,
    level: riskLevel(vol),
    maxDrawdown: maxDrawdown(closes),
    currentDrawdown: currentDrawdown(closes),
    worst,
    best,
    var95: sorted[Math.floor(0.05 * sorted.length)],
    upRatio: rets.filter((r) => r > 0).length / rets.length,
  };
}
