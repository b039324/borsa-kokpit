import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { getDividends, normalizeDividends } from "../src/dividends";
import { makeEnv, req, loginReq } from "./helpers";

const T_2023_05_16 = 1684195200; // 2023-05-16 00:00 UTC
const T_2022_05_10 = 1652140800; // 2022-05-10 00:00 UTC
const T_2021_08_02 = 1627862400; // 2021-08-02 00:00 UTC

const sample = {
  chart: {
    error: null,
    result: [
      {
        meta: { currency: "TRY", gmtoffset: 10800 },
        timestamp: [],
        indicators: { quote: [{}] },
        events: {
          dividends: {
            [T_2022_05_10]: { amount: 2.5, date: T_2022_05_10 },
            [T_2023_05_16]: { amount: 3, date: T_2023_05_16 },
          },
          splits: {
            [T_2021_08_02]: { date: T_2021_08_02, numerator: 2, denominator: 1, splitRatio: "2:1" },
          },
        },
      },
    ],
  },
};

describe("normalizeDividends", () => {
  it("temettüleri yeniden eskiye, tarihi YYYY-MM-DD olarak döndürür", () => {
    const d = normalizeDividends(sample, "THYAO");
    expect(d.symbol).toBe("THYAO");
    expect(d.currency).toBe("TRY");
    expect(d.dividends).toEqual([
      { date: "2023-05-16", amount: 3 },
      { date: "2022-05-10", amount: 2.5 },
    ]);
  });

  it("bölünmeleri yeniden eskiye, pay/payda ile döndürür", () => {
    const d = normalizeDividends(sample, "THYAO");
    expect(d.splits).toEqual([{ date: "2021-08-02", numerator: 2, denominator: 1 }]);
  });

  it("saat dilimi farkı tarihi kaydırır (gece yarısı öncesi UTC → yerel ertesi gün)", () => {
    const raw = JSON.parse(JSON.stringify(sample));
    const late = T_2023_05_16 - 3600; // 2023-05-15 23:00 UTC = 02:00 yerel (16 Mayıs)
    raw.chart.result[0].events.dividends = { [late]: { amount: 1, date: late } };
    expect(normalizeDividends(raw, "X").dividends[0].date).toBe("2023-05-16");
  });

  it("geçersiz tutarları (0, negatif, sayı değil) atar", () => {
    const raw = JSON.parse(JSON.stringify(sample));
    raw.chart.result[0].events.dividends = {
      "1": { amount: 0, date: T_2022_05_10 },
      "2": { amount: -1, date: T_2022_05_10 },
      "3": { amount: "x", date: T_2022_05_10 },
      "4": { amount: 4, date: T_2023_05_16 },
    };
    expect(normalizeDividends(raw, "X").dividends).toEqual([{ date: "2023-05-16", amount: 4 }]);
  });

  it("geçersiz bölünme oranını atar", () => {
    const raw = JSON.parse(JSON.stringify(sample));
    raw.chart.result[0].events.splits = { "1": { date: T_2021_08_02, numerator: 0, denominator: 1 } };
    expect(normalizeDividends(raw, "X").splits).toEqual([]);
  });

  it("olay yoksa boş listeler döner (temettü vermeyen hisse hata değildir)", () => {
    const raw = { chart: { error: null, result: [{ meta: { currency: "TRY", gmtoffset: 10800 }, timestamp: [] }] } };
    expect(normalizeDividends(raw, "X")).toEqual({ symbol: "X", currency: "TRY", dividends: [], splits: [] });
  });

  it("sonuç yoksa notfound", () => {
    expect(() => normalizeDividends({ chart: { result: null, error: { code: "Not Found", description: "x" } } }, "X")).toThrow();
  });
});

describe("getDividends", () => {
  it("chart ucunu olaylarla ve 10 yıl aralığıyla çağırır", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const out = await getDividends("THYAO", f as any);
    expect(out.dividends).toHaveLength(2);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/v8/finance/chart/THYAO.IS");
    expect(url).toContain("range=10y");
    expect(url).toContain("events=div%7Csplit");
  });

  it("404 → notfound; sunucu hatası → upstream", async () => {
    await expect(getDividends("ZZZZ", (async () => new Response("{}", { status: 404 })) as any)).rejects.toMatchObject({ kind: "notfound" });
    await expect(getDividends("THYAO", (async () => new Response("{}", { status: 500 })) as any)).rejects.toMatchObject({ kind: "upstream" });
  });
});

describe("/api/dividends", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function auth() {
    const env = makeEnv();
    const res = await worker.fetch(loginReq("dogru-sifre"), env);
    const { token } = (await res.json()) as { token: string };
    return { env, h: { Authorization: `Bearer ${token}` } };
  }
  const ok = () => vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));

  it("giriş olmadan 401", async () => {
    const f = ok();
    vi.stubGlobal("fetch", f);
    expect((await worker.fetch(req("/api/dividends?symbol=THYAO"), makeEnv())).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("geçersiz sembol 400, POST 405", async () => {
    vi.stubGlobal("fetch", ok());
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/dividends?symbol=../x", { headers: h }), env)).status).toBe(400);
    expect((await worker.fetch(req("/api/dividends?symbol=THYAO", { method: "POST", headers: h }), env)).status).toBe(405);
  });

  it("verileri döndürür", async () => {
    vi.stubGlobal("fetch", ok());
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/dividends?symbol=thyao", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.symbol).toBe("THYAO");
    expect(body.dividends[0]).toEqual({ date: "2023-05-16", amount: 3 });
    expect(body.splits).toHaveLength(1);
  });

  it("bulunamazsa 404, erişilemezse 502", async () => {
    const { env, h } = await auth();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect((await worker.fetch(req("/api/dividends?symbol=ZZZZ", { headers: h }), env)).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect((await worker.fetch(req("/api/dividends?symbol=THYAO", { headers: h }), env)).status).toBe(502);
  });
});
