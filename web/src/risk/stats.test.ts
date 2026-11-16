import { describe, expect, it } from "vitest";
import { annualizedVol, currentDrawdown, dailyReturns, maxDrawdown, riskLevel, riskStats, stdev } from "./stats";

const candles = (closes: number[]) =>
  closes.map((c, i) => ({ t: 1_700_000_000 + i * 86400, o: c, h: c, l: c, c, v: 1 }));

describe("dailyReturns", () => {
  it("ardışık kapanışlardan oran çıkarır", () => {
    const r = dailyReturns([100, 110, 99]);
    expect(r[0]).toBeCloseTo(0.1, 10);
    expect(r[1]).toBeCloseTo(-0.1, 10);
  });
  it("tek değerde boş", () => expect(dailyReturns([100])).toEqual([]));
});

describe("stdev / annualizedVol", () => {
  it("örnek standart sapma (n-1)", () => expect(stdev([0.1, -0.1])).toBeCloseTo(0.141421, 5));
  it("tek değerde 0", () => expect(stdev([0.1])).toBe(0));
  it("sabit getiride oynaklık 0", () => expect(annualizedVol([0.01, 0.01, 0.01])).toBe(0));
  it("sd × √252", () => expect(annualizedVol([0.1, -0.1])).toBeCloseTo(0.141421 * Math.sqrt(252), 4));
});

describe("drawdown", () => {
  it("maksimum düşüş zirveden dibe", () => {
    expect(maxDrawdown([100, 120, 90, 110, 80])).toBeCloseTo(-1 / 3, 6);
  });
  it("hiç düşmediyse 0", () => expect(maxDrawdown([100, 101, 102])).toBe(0));
  it("güncel düşüş: zirveye göre son fiyat", () => {
    expect(currentDrawdown([100, 120, 90])).toBeCloseTo(-0.25, 6);
    expect(currentDrawdown([100, 90, 120])).toBe(0);
  });
});

describe("riskLevel", () => {
  it("eşikler: <%25 düşük, <%45 orta, üstü yüksek", () => {
    expect(riskLevel(0.2)).toBe("düşük");
    expect(riskLevel(0.3)).toBe("orta");
    expect(riskLevel(0.5)).toBe("yüksek");
  });
});

describe("riskStats", () => {
  it("10 gün sabit + son gün %10 düşüş", () => {
    const s = riskStats(candles([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90]))!;
    expect(s.n).toBe(10);
    expect(s.vol).toBeCloseTo(0.502, 3);
    expect(s.maxDrawdown).toBeCloseTo(-0.1, 6);
    expect(s.currentDrawdown).toBeCloseTo(-0.1, 6);
    expect(s.worst.ret).toBeCloseTo(-0.1, 6);
    expect(s.worst.t).toBe(1_700_000_000 + 10 * 86400);
    expect(s.best.ret).toBe(0);
    expect(s.var95).toBeCloseTo(-0.1, 6);
    expect(s.upRatio).toBe(0);
    expect(s.level).toBe("yüksek");
  });

  it("10'dan az mumda null", () => {
    expect(riskStats(candles([100, 101, 102]))).toBeNull();
  });
});
