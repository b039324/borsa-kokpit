import { describe, it, expect } from "vitest";
import { GROUPS, applyFilters } from "./filters";
import type { StatsItem } from "../api";

const s = (symbol: string, o: Partial<StatsItem> = {}): StatsItem => ({
  symbol,
  price: 100,
  prevClose: 100,
  volume: 1000,
  avgVolume: 1000,
  vol: 0.4,
  rsi: 50,
  sma20: 100,
  sma50: 100,
  rangePos: 0.5,
  ...o,
});
const run = (items: StatsItem[], sel: Record<string, string>) => applyFilters(items, sel).map((r) => r.symbol);

describe("applyFilters", () => {
  const items = [
    s("A", { rsi: 25 }),
    s("B", { rsi: 75 }),
    s("C", { price: 110, sma50: 100, sma20: 105 }),
    s("D", { price: 90, sma50: 100, sma20: 95 }),
    s("E", { rangePos: 0.97 }),
    s("F", { rangePos: 0.03 }),
    s("G", { price: 104, prevClose: 100 }),
    s("H", { price: 96, prevClose: 100 }),
    s("I", { volume: 2500 }),
    s("J", { vol: 0.2 }),
    s("K", { vol: 0.8 }),
  ];

  it("filtre seçilmediyse hepsini verir", () => {
    expect(run(items, {})).toHaveLength(items.length);
    expect(run(items, { rsi: "" })).toHaveLength(items.length);
  });

  it("RSI: aşırı satım ≤30, aşırı alım ≥70", () => {
    expect(run(items, { rsi: "low" })).toEqual(["A"]);
    expect(run(items, { rsi: "high" })).toEqual(["B"]);
  });

  it("fiyat / SMA50", () => {
    expect(run(items, { sma50: "above" })).toEqual(["C", "G"]);
    expect(run(items, { sma50: "below" }).sort()).toEqual(["D", "H"]);
  });

  it("trend: SMA20 / SMA50", () => {
    expect(run(items, { trend: "up" })).toEqual(["C"]);
    expect(run(items, { trend: "down" })).toEqual(["D"]);
  });

  it("3 aylık aralık: zirveye ≥0,95, dibe ≤0,05 yakın", () => {
    expect(run(items, { range: "high" })).toEqual(["E"]);
    expect(run(items, { range: "low" })).toEqual(["F"]);
  });

  it("günlük değişim ±%3", () => {
    expect(run(items, { day: "up" })).toEqual(["C", "G"]);
    expect(run(items, { day: "down" })).toEqual(["H", "D"]);
  });

  it("hacim ≥ 2× ortalama", () => {
    expect(run(items, { volume: "spike" })).toEqual(["I"]);
  });

  it("oynaklık düşük ≤%30, yüksek ≥%60", () => {
    expect(run(items, { vol: "low" })).toEqual(["J"]);
    expect(run(items, { vol: "high" })).toEqual(["K"]);
  });

  it("seçilen tüm filtreler birlikte sağlanmalı (VE)", () => {
    const two = [s("X", { rsi: 25, price: 90, sma50: 100 }), s("Y", { rsi: 25, price: 110, sma50: 100 })];
    expect(run(two, { rsi: "low", sma50: "below" })).toEqual(["X"]);
  });

  it("eksik veri aktif filtreyi geçemez; filtre yoksa sorun olmaz", () => {
    const missing = [s("M", { rsi: null, sma50: null, rangePos: null, vol: null, avgVolume: null, prevClose: null })];
    for (const [g, o] of [["rsi", "low"], ["sma50", "above"], ["range", "high"], ["vol", "low"], ["volume", "spike"], ["day", "up"]]) {
      expect(run(missing, { [g]: o })).toEqual([]);
    }
    expect(run(missing, {})).toEqual(["M"]);
  });

  it("bilinmeyen grup ya da seçenek anahtarı yok sayılır", () => {
    expect(run(items, { yok: "x", rsi: "olmayan" })).toHaveLength(items.length);
  });

  it("günlük değişime göre azalan sıralar, değişimi olmayan sona; eşitte sembol", () => {
    const rows = applyFilters(
      [s("B", { price: 102 }), s("A", { price: 102 }), s("N", { prevClose: null }), s("C", { price: 105 })],
      {},
    );
    expect(rows.map((r) => r.symbol)).toEqual(["C", "A", "B", "N"]);
    expect(rows[0].pct).toBeCloseTo(5);
    expect(rows[3].pct).toBeNull();
  });

  it("satır; fiyat, değişim, RSI ve hacim oranını taşır", () => {
    const r = applyFilters([s("Z", { price: 110, volume: 3000, rsi: 61 })], {})[0];
    expect(r).toMatchObject({ symbol: "Z", price: 110, rsi: 61 });
    expect(r.ratio).toBe(3);
  });

  it("fiyatı olmayan hisse listelenmez", () => {
    expect(run([s("P", { price: null })], {})).toEqual([]);
  });
});

describe("GROUPS", () => {
  it("anahtarlar benzersiz; her grupta en az bir seçenek", () => {
    expect(new Set(GROUPS.map((g) => g.key)).size).toBe(GROUPS.length);
    for (const g of GROUPS) {
      expect(g.options.length).toBeGreaterThan(0);
      expect(new Set(g.options.map((o) => o.key)).size).toBe(g.options.length);
    }
  });
});
