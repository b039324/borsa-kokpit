import type { Candle } from "../api";

export interface Pivots {
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

// Klasik pivot noktaları (önceki günün yüksek/düşük/kapanışından).
export function pivotLevels(h: number, l: number, c: number): Pivots {
  const p = (h + l + c) / 3;
  return {
    p,
    r1: 2 * p - l,
    s1: 2 * p - h,
    r2: p + (h - l),
    s2: p - (h - l),
    r3: h + 2 * (p - l),
    s3: l - 2 * (h - p),
  };
}

// Yakın tepe/dip: her iki yanındaki k muma göre en yüksek/en düşük olan mum.
// Fiyatın altındaki en yüksek dip = destek; üstündeki en düşük tepe = direnç.
export function swingLevels(candles: Candle[], price: number, k = 2): { support: number | null; resistance: number | null } {
  let support: number | null = null;
  let resistance: number | null = null;
  for (let i = k; i < candles.length - k; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= k; j++) {
      if (!(candles[i].h > candles[i - j].h && candles[i].h > candles[i + j].h)) isHigh = false;
      if (!(candles[i].l < candles[i - j].l && candles[i].l < candles[i + j].l)) isLow = false;
    }
    if (isHigh && candles[i].h > price && (resistance === null || candles[i].h < resistance)) resistance = candles[i].h;
    if (isLow && candles[i].l < price && (support === null || candles[i].l > support)) support = candles[i].l;
  }
  return { support, resistance };
}

// Pivot için "önceki gün" mumu: son mum bugüne (TR günü) aitse bir öncekini, değilse sonuncuyu al.
export function pickPrevDay(candles: Candle[], gmtoffset: number, nowMs: number): Candle | null {
  if (candles.length === 0) return null;
  const dayOf = (sec: number) => Math.floor((sec + gmtoffset) / 86400);
  const today = dayOf(nowMs / 1000);
  const last = candles[candles.length - 1];
  if (dayOf(last.t) >= today) return candles.length > 1 ? candles[candles.length - 2] : null;
  return last;
}
