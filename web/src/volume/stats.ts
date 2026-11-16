import type { Candle } from "../api";

// Mum başına TL hacmi: kapanış × lot (gerçek işlem fiyatı ortalaması olmadığı için yaklaşık).
export const tlOf = (c: Candle) => c.c * c.v;

export interface VolumeStats {
  todayTL: number;
  todayLot: number;
  avgDailyTL: number | null; // son 20 günün ortalaması (bugün hariç)
  ratio: number | null; // bugün / ortalama
  days: number; // ortalamaya giren gün sayısı
}

const MIN_DAYS = 5;

// intraday: gün içi mumlar (bugün). daily: günlük mumlar; sonuncusu bugün/son seans sayılıp ortalamadan çıkarılır.
export function volumeStats(intraday: Candle[], daily: Candle[]): VolumeStats {
  const todayTL = intraday.reduce((s, c) => s + tlOf(c), 0);
  const todayLot = intraday.reduce((s, c) => s + c.v, 0);
  const past = daily.slice(-21, -1);
  const days = past.length;
  const avgDailyTL = days >= MIN_DAYS ? past.reduce((s, c) => s + tlOf(c), 0) / days : null;
  const ratio = avgDailyTL && avgDailyTL > 0 ? todayTL / avgDailyTL : null;
  return { todayTL, todayLot, avgDailyTL, ratio, days };
}
