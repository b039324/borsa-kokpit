import type { StatsItem } from "../api";

export interface SpikeRow {
  symbol: string;
  ratio: number; // güncel hacim / önceki 20 seans ortalaması
  volume: number;
  avgVolume: number;
  pct: number | null; // günlük değişim, yüzde
}

// Hacmi ortalamasının en az `minRatio` katına çıkanlar, orana göre azalan.
export function volumeSpikes(items: StatsItem[], minRatio = 2, n = 8): SpikeRow[] {
  const rows: SpikeRow[] = [];
  for (const s of items) {
    if (s.volume === null || s.avgVolume === null || !(s.avgVolume > 0)) continue;
    const ratio = s.volume / s.avgVolume;
    if (ratio < minRatio) continue;
    const pct = s.price !== null && s.prevClose ? ((s.price - s.prevClose) * 100) / s.prevClose : null;
    rows.push({ symbol: s.symbol, ratio, volume: s.volume, avgVolume: s.avgVolume, pct });
  }
  return rows.sort((a, b) => b.ratio - a.ratio || a.symbol.localeCompare(b.symbol)).slice(0, n);
}

export interface VolRow {
  symbol: string;
  vol: number; // yıllık oynaklık (oran)
}

export function rankByVol(items: StatsItem[], dir: "high" | "low", n = 8): VolRow[] {
  const rows: VolRow[] = [];
  for (const s of items) if (s.vol !== null) rows.push({ symbol: s.symbol, vol: s.vol });
  const sign = dir === "high" ? -1 : 1;
  return rows.sort((a, b) => sign * (a.vol - b.vol) || a.symbol.localeCompare(b.symbol)).slice(0, n);
}
