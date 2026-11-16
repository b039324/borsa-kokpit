import { describe, expect, it } from "vitest";
import { pivotLevels, pickPrevDay, swingLevels } from "./pivot";

const c = (t: number, h: number, l: number, cl = (h + l) / 2) => ({ t, o: cl, h, l, c: cl, v: 1 });

describe("pivotLevels (klasik)", () => {
  it("H=12 L=8 K=11 için seviyeleri hesaplar", () => {
    const p = pivotLevels(12, 8, 11);
    expect(p.p).toBeCloseTo(10.3333, 4);
    expect(p.r1).toBeCloseTo(12.6667, 4);
    expect(p.s1).toBeCloseTo(8.6667, 4);
    expect(p.r2).toBeCloseTo(14.3333, 4);
    expect(p.s2).toBeCloseTo(6.3333, 4);
    expect(p.r3).toBeCloseTo(16.6667, 4);
    expect(p.s3).toBeCloseTo(4.6667, 4);
  });
});

describe("swingLevels", () => {
  const highs = [10, 11, 12, 15, 12, 11, 10, 9, 10, 11];
  const lows = [8, 9, 10, 13, 10, 9, 8, 7, 8, 9];
  const candles = highs.map((h, i) => c(i, h, lows[i]));

  it("fiyatın altındaki en yakın dip destek, üstündeki en yakın tepe direnç", () => {
    expect(swingLevels(candles, 10)).toEqual({ support: 7, resistance: 15 });
  });

  it("fiyat tüm tepelerin üstündeyse direnç yok", () => {
    expect(swingLevels(candles, 20).resistance).toBeNull();
  });

  it("fiyat tüm diplerin altındaysa destek yok", () => {
    expect(swingLevels(candles, 5).support).toBeNull();
  });

  it("kenardaki mumlar tepe/dip sayılmaz; az mumda boş döner", () => {
    expect(swingLevels(candles.slice(0, 3), 10)).toEqual({ support: null, resistance: null });
  });
});

describe("pickPrevDay", () => {
  const off = 10800;
  // 2026-11-13 12:00 UTC ve 2026-11-16 07:00 UTC
  const d13 = Date.UTC(2026, 10, 13, 12) / 1000;
  const d16 = Date.UTC(2026, 10, 16, 7) / 1000;
  const list = [c(d13, 12, 8), c(d16, 13, 9)];

  it("son mum bugünse bir öncekini döner", () => {
    expect(pickPrevDay(list, off, d16 * 1000 + 3600_000)).toBe(list[0]);
  });

  it("son mum bugünden eskiyse son mumu döner", () => {
    const next = Date.UTC(2026, 10, 17, 9);
    expect(pickPrevDay(list, off, next)).toBe(list[1]);
  });

  it("boş listede null", () => {
    expect(pickPrevDay([], off, Date.now())).toBeNull();
  });
});
