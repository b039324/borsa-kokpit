import { describe, expect, it } from "vitest";
import { sectorStats, sortSectors } from "./stats";

const q = (price: number, prevClose: number, volume: number | null) => ({ symbol: "", price, prevClose, volume });
const sectors = { Banka: ["A", "B"], Enerji: ["C"], Boş: ["X", "Y"] };

describe("sectorStats", () => {
  it("TL hacim ağırlıklı ortalama değişim hesaplar", () => {
    // A: +10%, TL = 110×100 = 11.000 ; B: −10%, TL = 90×300 = 27.000
    const r = sectorStats({ A: q(110, 100, 100), B: q(90, 100, 300) }, { Banka: ["A", "B"] })[0];
    expect(r.tl).toBe(38_000);
    expect(r.pct).toBeCloseTo((10 * 11_000 + -10 * 27_000) / 38_000, 10);
    expect(r.counted).toBe(2);
  });

  it("en iyi ve en kötü hisseyi bulur, liste azalan sıralı", () => {
    const r = sectorStats({ A: q(110, 100, 100), B: q(90, 100, 300), C: q(100, 100, 5) }, { S: ["A", "B", "C"] })[0];
    expect(r.best?.symbol).toBe("A");
    expect(r.worst?.symbol).toBe("B");
    expect(r.list.map((m) => m.symbol)).toEqual(["A", "C", "B"]);
  });

  it("verisi eksik hisseyi hesaba katmaz, ama üye sayısında tutar", () => {
    const r = sectorStats({ A: q(110, 100, 100), B: q(90, 100, null) }, { Banka: ["A", "B", "Z"] })[0];
    expect(r.members).toBe(3);
    expect(r.counted).toBe(1);
    expect(r.pct).toBeCloseTo(10, 10);
  });

  it("hacmi sıfır veya önceki kapanışı olmayan hisse hesaba girmez", () => {
    const r = sectorStats({ A: q(10, 10, 0), B: { symbol: "B", price: 5, prevClose: null, volume: 10 } }, { S: ["A", "B"] })[0];
    expect(r.counted).toBe(0);
    expect(r.pct).toBeNull();
    expect(r.best).toBeNull();
  });

  it("hiç verisi olmayan sektör pct=null döner, çökmez", () => {
    const r = sectorStats({}, sectors);
    expect(r).toHaveLength(3);
    expect(r.every((s) => s.pct === null && s.tl === 0)).toBe(true);
  });

  it("tek hisseli sektörde ağırlıklı ortalama hissenin kendi değişimidir", () => {
    expect(sectorStats({ C: q(105, 100, 7) }, { Enerji: ["C"] })[0].pct).toBeCloseTo(5, 10);
  });
});

describe("sortSectors", () => {
  const stats = sectorStats(
    { A: q(110, 100, 10), B: q(90, 100, 1000), C: q(101, 100, 50) },
    { Yukarı: ["A"], Aşağı: ["B"], Orta: ["C"], Veriyok: ["Z"] },
  );
  it("değişime göre azalan, verisizler sonda", () => {
    expect(sortSectors(stats, "pct").map((s) => s.name)).toEqual(["Yukarı", "Orta", "Aşağı", "Veriyok"]);
  });
  it("hacme göre azalan, verisizler sonda", () => {
    // TL: Aşağı 90×1000=90.000, Orta 101×50=5.050, Yukarı 110×10=1.100
    expect(sortSectors(stats, "tl").map((s) => s.name)).toEqual(["Aşağı", "Orta", "Yukarı", "Veriyok"]);
  });
  it("girdiyi değiştirmez", () => {
    const before = stats.map((s) => s.name).join();
    sortSectors(stats, "pct");
    expect(stats.map((s) => s.name).join()).toBe(before);
  });
});
