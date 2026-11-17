import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { computeStats } from "../src/stats";
import type { ChartResult } from "../src/yahoo";
import { makeEnv, req, loginReq } from "./helpers";

const T0 = 1_700_000_000;
const DAY = 86400;

function chart(closes: number[], vols: number[], over: Partial<ChartResult> = {}): ChartResult {
  return {
    symbol: "THYAO",
    period: "3a",
    currency: "TRY",
    price: closes.at(-1) ?? null,
    prevClose: closes.at(-2) ?? null,
    gmtoffset: 10800,
    candles: closes.map((c, i) => ({ t: T0 + i * DAY, o: c, h: c, l: c, c, v: vols[i] ?? 0 })),
    ...over,
  };
}

const flat = (n: number, v = 100) => Array.from({ length: n }, () => v);

describe("computeStats", () => {
  it("son mumun hacmini, önceki 20 mumun ortalamasıyla birlikte verir", () => {
    const vols = [...flat(25, 100), 500];
    const s = computeStats(chart(flat(26, 10), vols));
    expect(s.volume).toBe(500);
    expect(s.avgVolume).toBe(100);
    expect(s.price).toBe(10);
    expect(s.prevClose).toBe(10);
  });

  it("ortalama yalnız son 20 öncül muma bakar", () => {
    const vols = [...flat(10, 1000), ...flat(20, 100), 300];
    expect(computeStats(chart(flat(31, 10), vols)).avgVolume).toBe(100);
  });

  it("hacmi sıfır olan mumlar ortalamaya girmez", () => {
    const vols = [0, 0, 100, 100, 100, 100, 100, 100, 400];
    expect(computeStats(chart(flat(9, 10), vols)).avgVolume).toBe(100);
  });

  it("5'ten az öncül mum varsa ortalama null", () => {
    expect(computeStats(chart(flat(5, 10), flat(5))).avgVolume).toBeNull();
  });

  it("sabit fiyatta oynaklık 0; dalgalı fiyatta pozitif ve daha oynak olan daha büyük", () => {
    const calm = Array.from({ length: 30 }, (_, i) => 100 + (i % 2));
    const wild = Array.from({ length: 30 }, (_, i) => 100 + (i % 2) * 10);
    expect(computeStats(chart(flat(30, 100), flat(30))).vol).toBe(0);
    const c = computeStats(chart(calm, flat(30))).vol!;
    const w = computeStats(chart(wild, flat(30))).vol!;
    expect(c).toBeGreaterThan(0);
    expect(w).toBeGreaterThan(c);
  });

  it("oynaklık yıllıklandırılmış orandır (günlük %1 ≈ %16)", () => {
    // getiriler +1% ve -1% dönüşümlü → örnek std ≈ 0,01 → × √252 ≈ 0,159
    const closes = [100];
    for (let i = 1; i < 31; i++) closes.push(closes[i - 1] * (i % 2 ? 1.01 : 0.99));
    expect(computeStats(chart(closes, flat(31))).vol!).toBeCloseTo(0.16, 1);
  });

  it("10'dan az getiri varsa oynaklık null; mum yoksa hepsi null", () => {
    expect(computeStats(chart(flat(8, 10), flat(8))).vol).toBeNull();
    const e = computeStats(chart([], []));
    expect(e).toMatchObject({ volume: null, avgVolume: null, vol: null, price: null });
  });
});

// ---- Uç nokta ----
function yahooBody(n: number, lastVol: number) {
  const ts = Array.from({ length: n }, (_, i) => T0 + i * DAY);
  const close = Array.from({ length: n }, (_, i) => 100 + (i % 3));
  const volume = Array.from({ length: n }, (_, i) => (i === n - 1 ? lastVol : 1000));
  return {
    chart: {
      result: [
        {
          meta: { currency: "TRY", regularMarketPrice: 101, chartPreviousClose: 100, gmtoffset: 10800 },
          timestamp: ts,
          indicators: { quote: [{ open: close, high: close, low: close, close, volume }] },
        },
      ],
      error: null,
    },
  };
}

async function auth() {
  const env = makeEnv();
  const res = await worker.fetch(loginReq("dogru-sifre"), env);
  const { token } = (await res.json()) as { token: string };
  return { env, h: { Authorization: `Bearer ${token}` } };
}
function stubYahoo(impl: (url: string) => Response) {
  const f = vi.fn(async (u: any) => impl(String(u)));
  vi.stubGlobal("fetch", f);
  return f;
}
afterEach(() => vi.unstubAllGlobals());

describe("/api/stats", () => {
  it("giriş olmadan 401 verir ve Yahoo'ya gitmez", async () => {
    const f = stubYahoo(() => new Response("{}"));
    expect((await worker.fetch(req("/api/stats?symbols=THYAO"), makeEnv())).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("her hisse için hacim, ortalama hacim ve oynaklık döndürür; 3 aylık günlük veri ister", async () => {
    const f = stubYahoo(() => new Response(JSON.stringify(yahooBody(30, 5000))));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/stats?symbols=thyao,garan", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.failed).toEqual([]);
    expect(body.stats.map((s: any) => s.symbol)).toEqual(["THYAO", "GARAN"]);
    expect(body.stats[0]).toMatchObject({ price: 101, prevClose: 100, volume: 5000, avgVolume: 1000 });
    expect(body.stats[0].vol).toBeGreaterThan(0);
    expect(String(f.mock.calls[0][0])).toContain("range=3mo&interval=1d");
  });

  it("bulunamayan hisse 'failed' listesine düşer, diğerleri döner", async () => {
    stubYahoo((u) =>
      u.includes("ZZZZ")
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify(yahooBody(30, 2000))),
    );
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/stats?symbols=THYAO,ZZZZ", { headers: h }), env);
    const body: any = await res.json();
    expect(body.stats).toHaveLength(1);
    expect(body.failed).toEqual(["ZZZZ"]);
  });

  it("Yahoo'ya hiç ulaşılamazsa 502", async () => {
    stubYahoo(() => new Response("hata", { status: 500 }));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/stats?symbols=THYAO,GARAN", { headers: h }), env);
    expect(res.status).toBe(502);
  });

  it.each([
    ["boş", "/api/stats?symbols="],
    ["parametre yok", "/api/stats"],
    ["geçersiz sembol", "/api/stats?symbols=TH/YAO"],
    ["21 sembol", `/api/stats?symbols=${Array.from({ length: 21 }, (_, i) => `AA${String(i).padStart(2, "0")}`).join(",")}`],
  ])("%s → 400", async (_n, url) => {
    stubYahoo(() => new Response("{}"));
    const { env, h } = await auth();
    expect((await worker.fetch(req(url, { headers: h }), env)).status).toBe(400);
  });

  it("POST 405", async () => {
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/stats?symbols=THYAO", { method: "POST", headers: h }), env)).status).toBe(405);
  });
});

describe("/api/chart: endeks, kur ve emtia takma adları", () => {
  it.each([
    ["USDTRY", "USDTRY%3DX"],
    ["EURTRY", "EURTRY%3DX"],
    ["GOLD", "GC%3DF"],
    ["BRENT", "BZ%3DF"],
    ["SP500", "%5EGSPC"],
    ["XU100", "XU100.IS"],
    ["THYAO", "THYAO.IS"],
  ])("%s → Yahoo'da %s", async (symbol, yahoo) => {
    const f = stubYahoo(() => new Response(JSON.stringify(yahooBody(30, 1))));
    const { env, h } = await auth();
    const res = await worker.fetch(req(`/api/chart?symbol=${symbol}&period=3a`, { headers: h }), env);
    expect(res.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toContain(`/chart/${yahoo}?`);
    expect(((await res.json()) as any).symbol).toBe(symbol);
  });
});

describe("computeStats: RSI, ortalamalar, aralık konumu", () => {
  // StockCharts örnek verisi: ilk RSI(14) ≈ 70,5; bir gün sonra (46,03) ≈ 66,3
  const base = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];

  it("RSI(14) Wilder yöntemiyle hesaplanır", () => {
    expect(computeStats(chart(base, flat(15))).rsi!).toBeCloseTo(70.5, 0);
    expect(computeStats(chart([...base, 46.03], flat(16))).rsi!).toBeCloseTo(66.3, 0);
  });

  it("yalnız yükselişte RSI 100, yalnız düşüşte 0, sabitte 50", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(computeStats(chart(up, flat(20))).rsi).toBe(100);
    expect(computeStats(chart(down, flat(20))).rsi).toBe(0);
    expect(computeStats(chart(flat(20, 100), flat(20))).rsi).toBe(50);
  });

  it("15'ten az kapanışta RSI null", () => {
    expect(computeStats(chart(flat(14, 10), flat(14))).rsi).toBeNull();
  });

  it("SMA20 ve SMA50 son kapanışların ortalamasıdır; yetmiyorsa null", () => {
    const closes = Array.from({ length: 60 }, (_, i) => i + 1); // 1..60
    const s = computeStats(chart(closes, flat(60)));
    expect(s.sma20).toBe(50.5); // 41..60
    expect(s.sma50).toBe(35.5); // 11..60
    const short = computeStats(chart(closes.slice(0, 30), flat(30)));
    expect(short.sma20).toBe(20.5); // 11..30
    expect(short.sma50).toBeNull();
    expect(computeStats(chart(closes.slice(0, 10), flat(10))).sma20).toBeNull();
  });

  it("aralık konumu: en düşük/en yüksek mum ve güncel fiyata göre 0..1", () => {
    const c = chart([100, 110, 120, 100], flat(4), { price: 110 });
    c.candles[1].h = 130;
    c.candles[2].l = 80;
    expect(computeStats(c).rangePos).toBeCloseTo((110 - 80) / (130 - 80));
  });

  it("fiyat aralığın dışındaysa 0 ya da 1'e kenetlenir; aralık yoksa null", () => {
    expect(computeStats(chart([100, 110], flat(2), { price: 150 })).rangePos).toBe(1);
    expect(computeStats(chart([100, 110], flat(2), { price: 50 })).rangePos).toBe(0);
    expect(computeStats(chart([100, 100], flat(2))).rangePos).toBeNull();
    expect(computeStats(chart([], [])).rangePos).toBeNull();
  });

  it("uçta yeni alanlar da döner", async () => {
    const ts = Array.from({ length: 60 }, (_, i) => T0 + i * DAY);
    const close = Array.from({ length: 60 }, (_, i) => 100 + i);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { regularMarketPrice: 159, chartPreviousClose: 158, gmtoffset: 10800 },
                  timestamp: ts,
                  indicators: { quote: [{ open: close, high: close, low: close, close, volume: close.map(() => 10) }] },
                },
              ],
              error: null,
            },
          }),
        ),
      ),
    );
    const env = makeEnv();
    const login = await worker.fetch(loginReq("dogru-sifre"), env);
    const { token } = (await login.json()) as { token: string };
    const res = await worker.fetch(req("/api/stats?symbols=THYAO", { headers: { Authorization: `Bearer ${token}` } }), env);
    const s = ((await res.json()) as any).stats[0];
    expect(s.rsi).toBe(100);
    expect(s.sma50).toBeCloseTo(134.5);
    expect(s.rangePos).toBe(1);
  });
});
