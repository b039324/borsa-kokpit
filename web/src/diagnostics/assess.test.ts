import { describe, expect, it } from "vitest";
import {
  assessChart, assessDividends, assessFinancials, assessFundamentals, assessList, assessMarket,
  assessQuotes, assessStats,
} from "./assess";

const candles = (n: number) => Array.from({ length: n }, (_, i) => ({ t: i, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }));
const chart = (over: object = {}) => ({ symbol: "AKBNK", period: "3a", currency: "TRY", price: 10, prevClose: 9, gmtoffset: 10800, candles: candles(5), ...over });

describe("assessMarket", () => {
  it("hiç kalem yoksa hata", () => expect(assessMarket([]).status).toBe("fail"));
  it("bazı fiyatlar boşsa uyarı ve sayıyı yazar", () => {
    const r = assessMarket([{ price: 1 }, { price: null }, { price: 2 }] as never);
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("2/3");
  });
  it("hepsi doluysa tamam", () => expect(assessMarket([{ price: 1 }, { price: 2 }] as never).status).toBe("ok"));
});

describe("assessChart", () => {
  it("mum yoksa hata", () => expect(assessChart(chart({ candles: [] }), "1g").status).toBe("fail"));
  it("fiyat null ise uyarı", () => expect(assessChart(chart({ price: null }), "1g").status).toBe("warn"));
  it("tamam ise mum sayısını yazar", () => {
    const r = assessChart(chart(), "3a");
    expect(r.status).toBe("ok");
    expect(r.detail).toContain("5 mum");
  });
});

describe("assessQuotes", () => {
  const q = (price: number | null) => ({ symbol: "X", price, prevClose: 1 });
  it("hiç fiyat gelmediyse hata", () => expect(assessQuotes([], [], 30).status).toBe("fail"));
  it("eksik hisseleri adıyla bildirir", () => {
    const r = assessQuotes([q(1), q(null)], ["ABCDE"], 3);
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("1/3");
    expect(r.detail).toContain("ABCDE");
  });
  it("hepsi geldiyse tamam", () => expect(assessQuotes([q(1), q(2)], [], 2).status).toBe("ok"));
});

describe("assessStats", () => {
  const s = (rsi: number | null, vol: number | null) => ({ symbol: "X", price: 1, prevClose: 1, volume: 1, avgVolume: 1, vol, rsi });
  it("boşsa hata", () => expect(assessStats([], [], 30).status).toBe("fail"));
  it("RSI eksikse (eski Worker) uyarı", () => {
    const r = assessStats([s(null, 0.3), s(null, 0.2)], [], 2);
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("RSI");
  });
  it("tamam", () => expect(assessStats([s(50, 0.3)], [], 1).status).toBe("ok"));
});

describe("assessFundamentals", () => {
  it("hiçbir alan yoksa hata", () => expect(assessFundamentals({ symbol: "X", name: null, marketCap: null } as never).status).toBe("fail"));
  it("az alan varsa uyarı", () => expect(assessFundamentals({ marketCap: 1, trailingPE: 2, beta: null } as never).status).toBe("warn"));
  it("çoğu alan doluysa tamam", () => {
    const f = Object.fromEntries(["marketCap", "trailingPE", "priceToBook", "beta", "trailingEps", "bookValue", "dividendYield", "returnOnEquity"].map((k) => [k, 1]));
    expect(assessFundamentals(f as never).status).toBe("ok");
  });
});

describe("assessFinancials", () => {
  const p = (revenue: number | null, netIncome: number | null = 5) => ({ date: "2025-12-31", revenue, grossProfit: null, operatingIncome: null, netIncome });
  it("yıllık dönem yoksa hata", () => expect(assessFinancials({ annual: [], quarterly: [] } as never, false).status).toBe("fail"));
  it("gelir hiç yoksa uyarı; banka ise bunu not eder", () => {
    const r = assessFinancials({ annual: [p(null)], quarterly: [p(null)] } as never, true);
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("banka");
  });
  it("gelir yoksa banka olmayanda da uyarı", () => expect(assessFinancials({ annual: [p(null)], quarterly: [] } as never, false).status).toBe("warn"));
  it("tamam", () => expect(assessFinancials({ annual: [p(10)], quarterly: [p(3)] } as never, false).status).toBe("ok"));
});

describe("assessDividends", () => {
  it("temettü yoksa uyarı", () => expect(assessDividends({ dividends: [], splits: [] } as never).status).toBe("warn"));
  it("temettü varsa tamam ve sayıyı yazar", () => {
    const r = assessDividends({ dividends: [{ date: "2025-01-01", amount: 1 }], splits: [] } as never);
    expect(r.status).toBe("ok");
    expect(r.detail).toContain("1 temettü");
  });
});

describe("assessList", () => {
  it("dizi değilse hata", () => expect(assessList(null as never, "favori").status).toBe("fail"));
  it("dizi ise tamam (boş olsa bile)", () => {
    const r = assessList([], "favori");
    expect(r.status).toBe("ok");
    expect(r.detail).toContain("0 favori");
  });
});
