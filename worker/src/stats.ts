import type { ChartResult } from "./yahoo";

export interface Stats {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  volume: number | null; // son seansın (güncel seansın) toplam lotu
  avgVolume: number | null; // önceki 20 seansın ortalama lotu
  vol: number | null; // yıllıklandırılmış oynaklık (oran), son ~60 günlük kapanıştan
  rsi: number | null; // RSI(14), Wilder
  sma20: number | null;
  sma50: number | null;
  rangePos: number | null; // 3 aylık en düşük (0) – en yüksek (1) aralığındaki konum
}

const BASE_DAYS = 20;
const MIN_BASE = 5;
const VOL_CLOSES = 61;
const MIN_RETURNS = 10;
const TRADING_DAYS = 252;

const RSI_PERIOD = 14;

// Wilder RSI: ilk ortalama düz ortalama, sonrası üstel yumuşatma. Yetmeyen veride null.
function rsi14(closes: number[]): number | null {
  if (closes.length < RSI_PERIOD + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= RSI_PERIOD; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / RSI_PERIOD;
  let avgLoss = loss / RSI_PERIOD;
  for (let i = RSI_PERIOD + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (RSI_PERIOD - 1) + (d > 0 ? d : 0)) / RSI_PERIOD;
    avgLoss = (avgLoss * (RSI_PERIOD - 1) + (d < 0 ? -d : 0)) / RSI_PERIOD;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  return closes.slice(-n).reduce((a, b) => a + b, 0) / n;
}

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

  const allCloses = candles.map((c) => c.c);
  let rangePos: number | null = null;
  if (candles.length > 0) {
    const lo = Math.min(...candles.map((c) => c.l));
    const hi = Math.max(...candles.map((c) => c.h));
    const price = chart.price ?? candles[candles.length - 1].c;
    if (hi > lo) rangePos = Math.min(1, Math.max(0, (price - lo) / (hi - lo)));
  }

  return {
    symbol: chart.symbol,
    price: chart.price,
    prevClose: chart.prevClose,
    volume: last ? last.v : null,
    avgVolume,
    vol,
    rsi: rsi14(allCloses),
    sma20: sma(allCloses, 20),
    sma50: sma(allCloses, 50),
    rangePos,
  };
}
