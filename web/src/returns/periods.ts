import type { Candle } from "../api";

const DAY = 86400;
// Haftalık mumlarda veri hedef tarihten en çok bu kadar geç başlayabilir.
const TOLERANCE = 8 * DAY;

// `days` takvim günü önceki kapanışa göre getiri (oran). Veri yetmiyorsa null.
export function returnSince(candles: Candle[], price: number, nowT: number, days: number): number | null {
  if (candles.length === 0) return null;
  const target = nowT - days * DAY;
  let ref: Candle | undefined;
  for (const c of candles) if (c.t <= target) ref = c;
  if (!ref) {
    const first = candles[0];
    if (first.t - target > TOLERANCE) return null;
    ref = first;
  }
  if (!(ref.c > 0) || !Number.isFinite(price)) return null;
  return price / ref.c - 1;
}

export interface Range52 {
  low: number;
  high: number;
  pos: number; // 0 = dip, 1 = zirve
}

// Mumların en düşük/en yüksek değeri; güncel fiyat dışarıdaysa aralık genişler.
export function range52(candles: Candle[], price: number): Range52 | null {
  if (candles.length === 0 || !Number.isFinite(price)) return null;
  let low = price;
  let high = price;
  for (const c of candles) {
    if (Number.isFinite(c.l) && c.l > 0) low = Math.min(low, c.l);
    if (Number.isFinite(c.h)) high = Math.max(high, c.h);
  }
  if (high <= low) return null;
  return { low, high, pos: (price - low) / (high - low) };
}
