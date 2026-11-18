import { describe, expect, it } from "vitest";
import { splitText, trDate, ttmTotal, yearlyTotals } from "./dividends";

const d = (date: string, amount: number) => ({ date, amount });

describe("trDate", () => {
  it("YYYY-MM-DD → GG.AA.YYYY", () => expect(trDate("2023-05-16")).toBe("16.05.2023"));
});

describe("splitText", () => {
  it("pay:payda", () => {
    expect(splitText({ numerator: 2, denominator: 1 })).toBe("2:1");
    expect(splitText({ numerator: 1, denominator: 10 })).toBe("1:10");
  });
  it("ondalıklı oranı da düzgün yazar", () => expect(splitText({ numerator: 1.5, denominator: 1 })).toBe("1,5:1"));
});

describe("ttmTotal", () => {
  const list = [d("2024-03-01", 1), d("2023-08-01", 2), d("2023-05-16", 3)];
  it("bugünden geriye 12 ay içindeki temettüleri toplar", () => {
    expect(ttmTotal(list, "2024-06-01")).toBe(3);
  });
  it("sınır: tam 12 ay önceki gün dahil değil, ertesi gün dahil", () => {
    expect(ttmTotal([d("2023-06-01", 5)], "2024-06-01")).toBe(0);
    expect(ttmTotal([d("2023-06-02", 5)], "2024-06-01")).toBe(5);
  });
  it("gelecek tarihli kayıt sayılmaz", () => {
    expect(ttmTotal([d("2024-07-01", 9)], "2024-06-01")).toBe(0);
  });
  it("boş liste 0", () => expect(ttmTotal([], "2024-06-01")).toBe(0));
});

describe("yearlyTotals", () => {
  it("yıl bazında toplam ve adet, yeniden eskiye", () => {
    const r = yearlyTotals([d("2024-03-01", 1), d("2023-08-01", 2), d("2023-05-16", 3)]);
    expect(r).toEqual([
      { year: 2024, total: 1, count: 1 },
      { year: 2023, total: 5, count: 2 },
    ]);
  });
  it("en fazla limit yıl döndürür", () => {
    const many = Array.from({ length: 12 }, (_, i) => d(`${2013 + i}-05-01`, 1));
    expect(yearlyTotals(many, 8)).toHaveLength(8);
    expect(yearlyTotals(many, 8)[0].year).toBe(2024);
  });
  it("boş liste boş", () => expect(yearlyTotals([])).toEqual([]));
});
