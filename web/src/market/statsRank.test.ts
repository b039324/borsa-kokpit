import { describe, it, expect } from "vitest";
import { rankByVol, volumeSpikes } from "./statsRank";

const s = (symbol: string, o: Partial<{ price: number | null; prevClose: number | null; volume: number | null; avgVolume: number | null; vol: number | null }> = {}) => ({
  symbol,
  price: 100,
  prevClose: 100,
  volume: 1000,
  avgVolume: 1000,
  vol: 0.3,
  ...o,
});

describe("volumeSpikes", () => {
  const items = [
    s("A", { volume: 5000 }), // 5x
    s("B", { volume: 2000, price: 110 }), // 2x, +10%
    s("C", { volume: 1900 }), // 1,9x → eşik altı
    s("D", { volume: 9000, avgVolume: null }), // ortalama yok
    s("E", { volume: null }), // hacim yok
    s("F", { volume: 3000, avgVolume: 0 }), // ortalama 0
    s("G", { volume: 3000 }), // 3x
  ];

  it("eşiği geçenleri oran sırasıyla verir", () => {
    expect(volumeSpikes(items).map((r) => r.symbol)).toEqual(["A", "G", "B"]);
  });
  it("oranı, hacmi ve günlük değişimi hesaplar", () => {
    const b = volumeSpikes(items).find((r) => r.symbol === "B")!;
    expect(b).toMatchObject({ ratio: 2, volume: 2000, avgVolume: 1000 });
    expect(b.pct).toBeCloseTo(10);
  });
  it("eşik ve adet ayarlanabilir", () => {
    expect(volumeSpikes(items, 1.5).map((r) => r.symbol)).toEqual(["A", "G", "B", "C"]);
    expect(volumeSpikes(items, 2, 1)).toHaveLength(1);
  });
  it("önceki kapanış yoksa değişim null", () => {
    expect(volumeSpikes([s("X", { volume: 4000, prevClose: null })])[0].pct).toBeNull();
  });
});

describe("rankByVol", () => {
  const items = [s("A", { vol: 0.5 }), s("B", { vol: 0.2 }), s("C", { vol: null }), s("D", { vol: 0.9 })];
  it("en oynaktan başlar", () => {
    expect(rankByVol(items, "high", 2).map((r) => r.symbol)).toEqual(["D", "A"]);
  });
  it("en sakinden başlar; oynaklığı olmayanı atar", () => {
    expect(rankByVol(items, "low", 10).map((r) => r.symbol)).toEqual(["B", "A", "D"]);
  });
});
