import { describe, expect, it } from "vitest";
import { buildColumns, growth, periodLabel, type Period } from "./table";

const p = (date: string, revenue: number | null, netIncome: number | null, extra: Partial<Period> = {}): Period => ({
  date, revenue, grossProfit: null, operatingIncome: null, netIncome, ...extra,
});

describe("growth", () => {
  it("(şimdiki − önceki) ÷ |önceki|", () => {
    expect(growth(120, 100)).toBeCloseTo(0.2, 9);
    expect(growth(80, 100)).toBeCloseTo(-0.2, 9);
  });
  it("önceki negatifse payda mutlak değerdir (zarardan kâra büyüme pozitif)", () => {
    expect(growth(30, -5)).toBeCloseTo(7, 9);
    expect(growth(-10, -5)).toBeCloseTo(-1, 9);
  });
  it("önceki 0 ya da eksikse null", () => {
    expect(growth(5, 0)).toBeNull();
    expect(growth(5, null)).toBeNull();
    expect(growth(null, 5)).toBeNull();
  });
});

describe("periodLabel", () => {
  it("yıllık: yıl; çeyreklik: yıl + Ç1..Ç4", () => {
    expect(periodLabel("2023-12-31", "annual")).toBe("2023");
    expect(periodLabel("2024-03-31", "quarterly")).toBe("2024 Ç1");
    expect(periodLabel("2024-06-30", "quarterly")).toBe("2024 Ç2");
    expect(periodLabel("2024-09-30", "quarterly")).toBe("2024 Ç3");
    expect(periodLabel("2024-12-31", "quarterly")).toBe("2024 Ç4");
  });
});

describe("buildColumns", () => {
  it("sırayı korur, etiket ve net marj ekler", () => {
    const cols = buildColumns([p("2022-12-31", 100, 10), p("2023-12-31", 200, 50)], "annual");
    expect(cols.map((c) => c.label)).toEqual(["2022", "2023"]);
    expect(cols[0].netMargin).toBeCloseTo(0.1, 9);
    expect(cols[1].netMargin).toBeCloseTo(0.25, 9);
  });

  it("yıllıkta büyüme bir önceki yılın dönemine göredir", () => {
    const cols = buildColumns([p("2022-12-31", 100, 10), p("2023-12-31", 150, 30)], "annual");
    expect(cols[0].revenueYoy).toBeNull();
    expect(cols[1].revenueYoy).toBeCloseTo(0.5, 9);
    expect(cols[1].netIncomeYoy).toBeCloseTo(2, 9);
  });

  it("çeyrekte büyüme geçen yılın aynı çeyreğine göredir (mevsimselliği bozmaz)", () => {
    const cols = buildColumns(
      [p("2023-03-31", 100, 10), p("2023-06-30", 300, 30), p("2024-03-31", 120, 5), p("2024-06-30", 330, 60)],
      "quarterly",
    );
    expect(cols[2].revenueYoy).toBeCloseTo(0.2, 9); // 2024 Ç1 / 2023 Ç1
    expect(cols[2].netIncomeYoy).toBeCloseTo(-0.5, 9);
    expect(cols[3].revenueYoy).toBeCloseTo(0.1, 9); // 2024 Ç2 / 2023 Ç2
    expect(cols[3].netIncomeYoy).toBeCloseTo(1, 9);
  });

  it("karşılaştırma dönemi listede yoksa büyüme null", () => {
    const cols = buildColumns([p("2023-06-30", 100, 10), p("2024-03-31", 120, 12)], "quarterly");
    expect(cols[1].revenueYoy).toBeNull();
  });

  it("gelir yok ya da 0 ise net marj null; eksik kalemler null kalır", () => {
    const cols = buildColumns([p("2023-12-31", null, 10), p("2024-12-31", 0, 10)], "annual");
    expect(cols[0].netMargin).toBeNull();
    expect(cols[1].netMargin).toBeNull();
    expect(cols[0].grossProfit).toBeNull();
  });

  it("boş liste boş döner", () => {
    expect(buildColumns([], "annual")).toEqual([]);
  });
});
