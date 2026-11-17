import type { ChartResult } from "./yahoo";

export interface Stats {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  volume: number | null; // son seansın (güncel seansın) toplam lotu
  avgVolume: number | null; // önceki 20 seansın ortalama lotu
  vol: number | null; // yıllıklandırılmış oynaklık (oran), son ~60 günlük kapanıştan
}

const BASE_DAYS = 20;
const MIN_BASE = 5;
const VOL_CLOSES = 61;
const MIN_RETURNS = 10;
const TRADING_DAYS = 252;

// 3 aylık günlük mumlardan hacim ve oynaklık özeti. Sıralama ve tarama modülleri bunu kullanır.
export function computeStats(chart: ChartResult): Stats {
  const candles = chart.candles;
  const last = candles.at(-1);

  const prior = candles
    .slice(Math.max(0, candles.length - 1 - BASE_DAYS), -1)
    .map((c) => c.v)
    .filter((v) => v > 0);
  const avgVolume = prior.length >= MIN_BASE ? prior.reduce((a, b) => a + b, 0) / prior.length : null;

  const closes = candles.slice(-VOL_CLOSES).map((c) => c.c);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push(closes[i] / closes[i - 1] - 1);
  let vol: number | null = null;
  if (returns.length >= MIN_RETURNS) {
    const m = returns.reduce((a, b) => a + b, 0) / returns.length;
    const sd = Math.sqrt(returns.reduce((a, r) => a + (r - m) ** 2, 0) / (returns.length - 1));
    vol = sd * Math.sqrt(TRADING_DAYS);
  }

  return {
    symbol: chart.symbol,
    price: chart.price,
    prevClose: chart.prevClose,
    volume: last ? last.v : null,
    avgVolume,
    vol,
  };
}
