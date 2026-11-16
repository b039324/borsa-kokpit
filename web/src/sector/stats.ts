import type { QuoteItem } from "../api";

export interface MemberStat {
  symbol: string;
  pct: number;
  tl: number;
}

export interface SectorStat {
  name: string;
  members: number; // sektördeki toplam hisse
  counted: number; // verisi gelen ve hesaba giren hisse
  pct: number | null; // TL hacim ağırlıklı ortalama değişim; veri yoksa null
  tl: number; // toplam TL hacim
  best: MemberStat | null;
  worst: MemberStat | null;
  list: MemberStat[]; // değişime göre azalan
}

// Sektör değişimi = üyelerin günlük değişiminin TL hacimle ağırlıklı ortalaması
// (piyasa değeri verisi olmadığı için hacim kullanılır; resmî sektör endeksi değildir).
// Fiyatı, önceki kapanışı veya hacmi olmayan hisse hesaba girmez.
export function sectorStats(quotes: Record<string, QuoteItem>, sectors: Record<string, string[]>): SectorStat[] {
  return Object.entries(sectors).map(([name, symbols]) => {
    const list: MemberStat[] = [];
    for (const s of symbols) {
      const q = quotes[s];
      const price = q?.price ?? null;
      const prev = q?.prevClose ?? null;
      const vol = q?.volume ?? null;
      if (price === null || !prev || vol === null || price * vol <= 0) continue;
      list.push({ symbol: s, pct: ((price - prev) / prev) * 100, tl: price * vol });
    }
    const tl = list.reduce((a, m) => a + m.tl, 0);
    const pct = list.length ? list.reduce((a, m) => a + m.pct * m.tl, 0) / tl : null;
    list.sort((a, b) => b.pct - a.pct);
    return {
      name, members: symbols.length, counted: list.length, pct, tl,
      best: list[0] ?? null,
      worst: list.length ? list[list.length - 1] : null,
      list,
    };
  });
}

export type SortKey = "pct" | "tl";

// Verisi olmayan sektörler her zaman sona gider.
export function sortSectors(stats: SectorStat[], key: SortKey): SectorStat[] {
  return [...stats].sort((a, b) => {
    if ((a.pct === null) !== (b.pct === null)) return a.pct === null ? 1 : -1;
    return key === "pct" ? (b.pct ?? 0) - (a.pct ?? 0) : b.tl - a.tl;
  });
}
