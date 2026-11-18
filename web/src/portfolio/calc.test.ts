import { describe, expect, it } from "vitest";
import { buildPortfolio, mergeLot, type Position } from "./calc";

const q = (price: number | null, prevClose: number | null = null) => ({ price, prevClose });

describe("buildPortfolio", () => {
  const positions: Position[] = [
    { symbol: "AAA", qty: 100, cost: 10 }, // maliyet 1000
    { symbol: "BBB", qty: 50, cost: 20 }, // maliyet 1000
  ];

  it("satır değerleri: değer, kâr/zarar, yüzde, günlük, ağırlık", () => {
    const { rows } = buildPortfolio(positions, { AAA: q(12, 11), BBB: q(18, 19) });
    const a = rows[0];
    expect(a.value).toBe(1200);
    expect(a.costTotal).toBe(1000);
    expect(a.pl).toBe(200);
    expect(a.plPct).toBeCloseTo(0.2, 9);
    expect(a.dayPl).toBe(100); // 100 × (12-11)
    const b = rows[1];
    expect(b.value).toBe(900);
    expect(b.pl).toBe(-100);
    expect(b.plPct).toBeCloseTo(-0.1, 9);
    expect(b.dayPl).toBe(-50);
    expect(a.weight).toBeCloseTo(1200 / 2100, 9);
    expect(b.weight).toBeCloseTo(900 / 2100, 9);
  });

  it("toplamlar", () => {
    const { totals } = buildPortfolio(positions, { AAA: q(12, 11), BBB: q(18, 19) });
    expect(totals.value).toBe(2100);
    expect(totals.cost).toBe(2000);
    expect(totals.pl).toBe(100);
    expect(totals.plPct).toBeCloseTo(0.05, 9);
    expect(totals.dayPl).toBe(50);
    // günlük % = günlük K/Z ÷ dünkü değer (100×11 + 50×19 = 2050)
    expect(totals.dayPct).toBeCloseTo(50 / 2050, 9);
    expect(totals.priced).toBe(2);
    expect(totals.total).toBe(2);
  });

  it("fiyatı olmayan pozisyon toplamlara girmez, satırı '–' kalır, sayaç farkı gösterir", () => {
    const { rows, totals } = buildPortfolio(positions, { AAA: q(12, 11) });
    expect(rows[1].price).toBeNull();
    expect(rows[1].value).toBeNull();
    expect(rows[1].pl).toBeNull();
    expect(rows[1].weight).toBeNull();
    expect(totals.value).toBe(1200);
    expect(totals.cost).toBe(1000);
    expect(totals.priced).toBe(1);
    expect(totals.total).toBe(2);
  });

  it("önceki kapanış yoksa günlük K/Z null, toplam günlük yalnız bilinenlerden", () => {
    const { rows, totals } = buildPortfolio(positions, { AAA: q(12, 11), BBB: q(18, null) });
    expect(rows[1].dayPl).toBeNull();
    expect(totals.dayPl).toBe(100);
    expect(totals.dayPct).toBeCloseTo(100 / 1100, 9);
  });

  it("boş portföy: sıfır toplam, yüzdeler null", () => {
    const { rows, totals } = buildPortfolio([], {});
    expect(rows).toEqual([]);
    expect(totals).toMatchObject({ value: 0, cost: 0, pl: 0, plPct: null, dayPl: 0, dayPct: null, priced: 0, total: 0 });
  });

  it("hiç fiyat yoksa toplam değer 0, ağırlıklar null", () => {
    const { rows, totals } = buildPortfolio(positions, {});
    expect(totals.value).toBe(0);
    expect(totals.plPct).toBeNull();
    expect(rows.every((r) => r.weight === null)).toBe(true);
  });

  it("girdi sırası korunur", () => {
    const { rows } = buildPortfolio([...positions].reverse(), { AAA: q(1), BBB: q(1) });
    expect(rows.map((r) => r.symbol)).toEqual(["BBB", "AAA"]);
  });
});

describe("mergeLot", () => {
  const base: Position[] = [{ symbol: "AAA", qty: 100, cost: 10 }];

  it("yeni sembol sona eklenir", () => {
    expect(mergeLot(base, "BBB", 5, 20)).toEqual([...base, { symbol: "BBB", qty: 5, cost: 20 }]);
  });
  it("mevcut sembole ekleme ağırlıklı ortalama maliyet verir", () => {
    // 100×10 + 50×16 = 1800 / 150 = 12
    expect(mergeLot(base, "AAA", 50, 16)).toEqual([{ symbol: "AAA", qty: 150, cost: 12 }]);
  });
  it("girdiyi değiştirmez", () => {
    const copy = JSON.parse(JSON.stringify(base));
    mergeLot(base, "AAA", 1, 1);
    expect(base).toEqual(copy);
  });
});
