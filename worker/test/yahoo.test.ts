import { describe, expect, it } from "vitest";
import {
  PERIODS, YahooError, aggregateSessions, getChart, isPeriod, normalizeChart, normalizeSearch, searchSymbols,
} from "../src/yahoo";

// 2026-11-10 (Salı) 10:00 TR = 07:00 UTC
const T0 = Date.UTC(2026, 10, 10, 7, 0, 0) / 1000;
const chartBody = (n: number, extra: any = {}) => ({
  chart: {
    result: [{
      meta: { currency: "TRY", regularMarketPrice: 310.5, chartPreviousClose: 300, gmtoffset: 10800 },
      timestamp: Array.from({ length: n }, (_, i) => T0 + i * 3600),
      indicators: { quote: [{
        open: Array.from({ length: n }, (_, i) => 100 + i),
        high: Array.from({ length: n }, (_, i) => 110 + i),
        low: Array.from({ length: n }, (_, i) => 90 + i),
        close: Array.from({ length: n }, (_, i) => 105 + i),
        volume: Array.from({ length: n }, () => 10),
      }] },
      ...extra,
    }],
    error: null,
  },
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("dönem tablosu", () => {
  it("kullanıcının mum tablosuyla uyuşur", () => {
    expect(PERIODS["1g"]).toMatchObject({ range: "1d", interval: "5m" });
    expect(PERIODS["1h"]).toMatchObject({ range: "5d", interval: "60m" });
    expect(PERIODS["1a"]).toMatchObject({ range: "1mo", interval: "60m", aggregate: 4 });
    expect(PERIODS["3a"]).toMatchObject({ range: "3mo", interval: "1d" });
    expect(PERIODS["6a"]).toMatchObject({ range: "6mo", interval: "1wk" });
    expect(PERIODS["1y"]).toMatchObject({ range: "1y", interval: "1wk" });
    expect(PERIODS["5y"]).toMatchObject({ range: "5y", interval: "1mo" });
  });
  it("isPeriod yalnız bilinenleri kabul eder", () => {
    expect(isPeriod("1g")).toBe(true);
    expect(isPeriod("toString")).toBe(false);
    expect(isPeriod("2y")).toBe(false);
  });
});

describe("normalizeChart", () => {
  it("mumları ve meta bilgisini çıkarır", () => {
    const r = normalizeChart(chartBody(3), "THYAO", "1g");
    expect(r.candles).toHaveLength(3);
    expect(r.candles[0]).toEqual({ t: T0, o: 100, h: 110, l: 90, c: 105, v: 10 });
    expect(r).toMatchObject({ symbol: "THYAO", currency: "TRY", price: 310.5, prevClose: 300 });
  });
  it("boş (null) mumları atar", () => {
    const b = chartBody(3);
    b.chart.result[0].indicators.quote[0].close[1] = null as any;
    expect(normalizeChart(b, "THYAO", "1g").candles).toHaveLength(2);
  });
  it("Not Found hatasını notfound olarak işaretler", () => {
    const b = { chart: { result: null, error: { code: "Not Found", description: "x" } } };
    expect(() => normalizeChart(b, "XXXX", "1g")).toThrow(YahooError);
    try { normalizeChart(b, "XXXX", "1g"); } catch (e) { expect((e as YahooError).kind).toBe("notfound"); }
  });
  it("sonuç yoksa notfound", () => {
    expect(() => normalizeChart({ chart: { result: [] } }, "X", "1g")).toThrow(/Veri yok/);
  });
});

describe("4 saatlik birleştirme", () => {
  it("8 saatlik mumu günde 2 kovaya (10-13, 14-17) toplar", () => {
    const r = normalizeChart(chartBody(8), "THYAO", "1a");
    expect(r.candles).toHaveLength(2);
    const [a, b] = r.candles;
    expect(a).toEqual({ t: T0, o: 100, h: 113, l: 90, c: 108, v: 40 });
    expect(b.o).toBe(104);
    expect(b.c).toBe(112);
    expect(b.h).toBe(117);
    expect(b.l).toBe(94);
  });
  it("gün sınırında kovalar karışmaz", () => {
    const c = (t: number) => ({ t, o: 1, h: 2, l: 0, c: 1, v: 1 });
    const out = aggregateSessions([c(T0 + 7 * 3600), c(T0 + 24 * 3600)], 10800);
    expect(out).toHaveLength(2);
  });
});

describe("getChart", () => {
  it("doğru adresi çağırır (.IS eki ve aralık)", async () => {
    let url = "";
    await getChart("THYAO", "3a", async (u) => { url = u; return ok(chartBody(2)); });
    expect(url).toContain("/v8/finance/chart/THYAO.IS");
    expect(url).toContain("range=3mo");
    expect(url).toContain("interval=1d");
  });
  it("query1 hata verirse query2'ye geçer", async () => {
    const hosts: string[] = [];
    const r = await getChart("THYAO", "1g", async (u) => {
      hosts.push(new URL(u).host);
      return hosts.length === 1 ? new Response("x", { status: 500 }) : ok(chartBody(2));
    });
    expect(hosts).toEqual(["query1.finance.yahoo.com", "query2.finance.yahoo.com"]);
    expect(r.candles).toHaveLength(2);
  });
  it("404'te yedeğe geçmeden notfound atar", async () => {
    let n = 0;
    await expect(getChart("XXXX", "1g", async () => { n++; return new Response("", { status: 404 }); }))
      .rejects.toMatchObject({ kind: "notfound" });
    expect(n).toBe(1);
  });
  it("iki adres de düşerse upstream hatası verir", async () => {
    await expect(getChart("THYAO", "1g", async () => { throw new Error("ağ"); }))
      .rejects.toMatchObject({ kind: "upstream" });
  });
});

describe("arama", () => {
  const body = { quotes: [
    { symbol: "THYAO.IS", quoteType: "EQUITY", longname: "Turk Hava Yollari A.O.", shortname: "TURK HAVA YOLLARI" },
    { symbol: "THYAO.F", quoteType: "EQUITY", shortname: "THY Frankfurt" },
    { symbol: "TKFEN.IS", quoteType: "EQUITY", shortname: "TEKFEN HOLDING" },
    { symbol: "XU100.IS", quoteType: "INDEX", shortname: "BIST 100" },
  ] };
  it("yalnız BIST hisselerini döndürür, .IS eki atılır", () => {
    expect(normalizeSearch(body)).toEqual([
      { symbol: "THYAO", name: "Turk Hava Yollari A.O." },
      { symbol: "TKFEN", name: "TEKFEN HOLDING" },
    ]);
  });
  it("boş yanıtta boş dizi", () => {
    expect(normalizeSearch({})).toEqual([]);
  });
  it("sorguyu kodlayarak gönderir", async () => {
    let url = "";
    await searchSymbols("türk hava", async (u) => { url = u; return ok(body); });
    expect(url).toContain("/v1/finance/search?q=t%C3%BCrk%20hava");
  });
});

import { getQuote, normalizeQuote } from "../src/yahoo";

describe("tekil fiyat", () => {
  const body = { chart: { result: [{ meta: { regularMarketPrice: 55.5, chartPreviousClose: 50, regularMarketVolume: 1234 } }], error: null } };
  it("fiyat, önceki kapanış ve hacmi çıkarır", () => {
    expect(normalizeQuote(body, "THYAO")).toEqual({ symbol: "THYAO", price: 55.5, prevClose: 50, volume: 1234 });
  });
  it("eksik alanlar null olur", () => {
    const b = { chart: { result: [{ meta: {} }] } };
    expect(normalizeQuote(b, "X")).toEqual({ symbol: "X", price: null, prevClose: null, volume: null });
  });
  it("Not Found → notfound", () => {
    try {
      normalizeQuote({ chart: { error: { code: "Not Found", description: "yok" } } }, "X");
      throw new Error("hata beklenirdi");
    } catch (e) {
      expect(e).toBeInstanceOf(YahooError);
      expect((e as YahooError).kind).toBe("notfound");
    }
  });
  it("küçük istek atar: range=1d&interval=1d", async () => {
    let url = "";
    await getQuote("THYAO", async (u) => { url = u; return new Response(JSON.stringify(body)); });
    expect(url).toContain("THYAO.IS");
    expect(url).toContain("range=1d&interval=1d");
  });
});
