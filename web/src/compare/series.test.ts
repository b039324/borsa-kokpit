import { describe, it, expect } from "vitest";
import { alignAsOf, rebase, ratioSeries, totalReturn } from "./series";

const DAY = 86400;
const cd = (day: number, c: number, hourUtc = 7) => ({ t: day * DAY + hourUtc * 3600, o: c, h: c, l: c, c, v: 1 });

describe("alignAsOf", () => {
  it("aynı günlerde eşler", () => {
    const a = [cd(10, 100), cd(11, 110)];
    const b = [cd(10, 5), cd(11, 6)];
    expect(alignAsOf(a, 0, b, 0)).toEqual([
      { t: a[0].t, a: 100, b: 5 },
      { t: a[1].t, a: 110, b: 6 },
    ]);
  });

  it("B'de eksik gün varsa önceki değeri taşır (tatil, hafta sonu)", () => {
    const out = alignAsOf([cd(10, 1), cd(11, 2), cd(12, 3)], 0, [cd(10, 7), cd(12, 9)], 0);
    expect(out.map((p) => p.b)).toEqual([7, 7, 9]);
  });

  it("B'nin ilk verisinden önceki A günlerini atar", () => {
    const out = alignAsOf([cd(9, 1), cd(10, 2)], 0, [cd(10, 7)], 0);
    expect(out).toHaveLength(1);
    expect(out[0].a).toBe(2);
  });

  it("B verisi 7 günden eskiyse eşlemez", () => {
    expect(alignAsOf([cd(30, 1)], 0, [cd(10, 7)], 0)).toEqual([]);
  });

  it("her serinin kendi saat dilimi farkıyla gün hesaplanır", () => {
    // B (kur) mumu 23:00 UTC'de, +1 saat farkıyla ertesi günün başı = 11. gün
    const b = [{ ...cd(10, 8, 23), t: 10 * DAY + 23 * 3600 }];
    const out = alignAsOf([cd(11, 100, 7)], 0, b, 3600);
    expect(out).toHaveLength(1);
    expect(out[0].b).toBe(8);
  });

  it("boş girdi boş döner", () => {
    expect(alignAsOf([], 0, [cd(1, 1)], 0)).toEqual([]);
    expect(alignAsOf([cd(1, 1)], 0, [], 0)).toEqual([]);
  });
});

describe("rebase / ratioSeries / totalReturn", () => {
  it("ilk değeri 100 yapar", () => {
    expect(rebase([50, 100, 25])).toEqual([100, 200, 50]);
  });
  it("ilk değer geçersizse boş döner", () => {
    expect(rebase([])).toEqual([]);
    expect(rebase([0, 5])).toEqual([]);
  });
  it("oran serisi a/b'nin 100'e çekilmişidir", () => {
    const pairs = [
      { t: 1, a: 10, b: 2 },
      { t: 2, a: 22, b: 2 },
      { t: 3, a: 10, b: 4 },
    ];
    expect(ratioSeries(pairs)).toEqual([100, 220, 50]);
  });
  it("toplam getiri son/ilk - 1", () => {
    expect(totalReturn([100, 150])).toBeCloseTo(0.5);
    expect(totalReturn([100])).toBeNull();
    expect(totalReturn([])).toBeNull();
  });
});
