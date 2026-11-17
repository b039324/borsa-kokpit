import { describe, it, expect } from "vitest";
import { breadth, nearLimit, rankRows, topGainers, topLosers, topVolume } from "./movers";

const q = (price: number | null, prevClose: number | null, volume?: number | null) => ({
  symbol: "",
  price,
  prevClose,
  volume,
});

const quotes = {
  AAA: { ...q(110, 100, 1000), symbol: "AAA" }, // +10, TL 110000
  BBB: { ...q(95, 100, 5000), symbol: "BBB" }, // -5, TL 475000
  CCC: { ...q(100, 100, 100), symbol: "CCC" }, // 0, TL 10000
  DDD: { ...q(91, 100, 200), symbol: "DDD" }, // -9, TL 18200
  EEE: { ...q(null, 100, 10), symbol: "EEE" }, // fiyat yok
  FFF: { ...q(50, null, 10), symbol: "FFF" }, // önceki kapanış yok
};
const syms = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "YOK"];

describe("rankRows", () => {
  it("yüzde ve TL hacmi hesaplar; fiyatı olmayan ve kotasyonu gelmeyeni atar", () => {
    const rows = rankRows(syms, quotes);
    expect(rows.map((r) => r.symbol)).toEqual(["AAA", "BBB", "CCC", "DDD", "FFF"]);
    expect(rows[0]).toMatchObject({ pct: 10, tl: 110000, price: 110 });
    expect(rows[4].pct).toBeNull(); // önceki kapanış yok
  });
});

describe("sıralamalar", () => {
  const rows = rankRows(syms, quotes);
  it("en çok yükselen: azalan yüzde, yüzdesiz olanlar hariç", () => {
    expect(topGainers(rows, 2).map((r) => r.symbol)).toEqual(["AAA", "CCC"]);
  });
  it("en çok düşen: artan yüzde", () => {
    expect(topLosers(rows, 2).map((r) => r.symbol)).toEqual(["DDD", "BBB"]);
  });
  it("en çok hacimli: TL hacme göre", () => {
    expect(topVolume(rows, 3).map((r) => r.symbol)).toEqual(["BBB", "AAA", "DDD"]);
  });
  it("n'den az veri varsa olanı verir; girdi değişmez", () => {
    const copy = [...rows];
    expect(topGainers(rows, 50)).toHaveLength(4);
    expect(rows).toEqual(copy);
  });
  it("eşit yüzdede sembole göre sabit sıra", () => {
    const r = rankRows(["B", "A"], {
      A: { symbol: "A", price: 101, prevClose: 100 },
      B: { symbol: "B", price: 101, prevClose: 100 },
    });
    expect(topGainers(r, 2).map((x) => x.symbol)).toEqual(["A", "B"]);
  });
});

describe("breadth", () => {
  it("yükselen/düşen/yatay sayar ve oranı verir", () => {
    const b = breadth(rankRows(syms, quotes));
    expect(b).toEqual({ up: 1, down: 2, flat: 1, total: 4, upRatio: 0.25 });
  });
  it("veri yoksa oran null", () => {
    expect(breadth([])).toEqual({ up: 0, down: 0, flat: 0, total: 0, upRatio: null });
  });
});

describe("nearLimit", () => {
  it("±%9 ve ötesini tavana/tabana yakın sayar", () => {
    const n = nearLimit(rankRows(syms, quotes));
    expect(n.up.map((r) => r.symbol)).toEqual(["AAA"]);
    expect(n.down.map((r) => r.symbol)).toEqual(["DDD"]);
  });
  it("eşik özelleştirilebilir; sıra en uçtan başlar", () => {
    const n = nearLimit(rankRows(syms, quotes), 5);
    expect(n.down.map((r) => r.symbol)).toEqual(["DDD", "BBB"]);
  });
});
