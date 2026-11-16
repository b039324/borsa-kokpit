import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { makeEnv, req, loginReq } from "./helpers";

const T0 = 1_700_000_000;
const yahooChart = {
  chart: {
    result: [{
      meta: { currency: "TRY", regularMarketPrice: 300, chartPreviousClose: 290, gmtoffset: 10800 },
      timestamp: [T0, T0 + 300],
      indicators: { quote: [{ open: [1, 2], high: [3, 4], low: [0, 1], close: [2, 3], volume: [5, 6] }] },
    }],
    error: null,
  },
};

async function auth() {
  const env = makeEnv();
  const res = await worker.fetch(loginReq("dogru-sifre"), env);
  const { token } = (await res.json()) as { token: string };
  return { env, h: { Authorization: `Bearer ${token}` } };
}

function stubYahoo(impl: (url: string) => Response | Promise<Response>) {
  const f = vi.fn(async (u: any) => impl(String(u)));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe("/api/chart", () => {
  it("giriş olmadan 401 verir ve Yahoo'ya gitmez", async () => {
    const f = stubYahoo(() => new Response("{}"));
    const res = await worker.fetch(req("/api/chart?symbol=THYAO&period=1g"), makeEnv());
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("mumları döndürür", async () => {
    stubYahoo(() => new Response(JSON.stringify(yahooChart)));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/chart?symbol=thyao&period=1g", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.symbol).toBe("THYAO");
    expect(body.candles).toHaveLength(2);
    expect(body.price).toBe(300);
  });

  it("dönem verilmezse gün içi (1g) varsayılır", async () => {
    const f = stubYahoo(() => new Response(JSON.stringify(yahooChart)));
    const { env, h } = await auth();
    await worker.fetch(req("/api/chart?symbol=THYAO", { headers: h }), env);
    expect(f.mock.calls[0][0]).toContain("interval=5m");
  });

  it.each([
    ["symbol yok", "/api/chart?period=1g"],
    ["sembolde özel karakter", "/api/chart?symbol=TH/YAO&period=1g"],
    ["çok uzun sembol", "/api/chart?symbol=ABCDEFGHIJ&period=1g"],
    ["bilinmeyen dönem", "/api/chart?symbol=THYAO&period=2y"],
  ])("geçersiz istek 400: %s", async (_n, path) => {
    const f = stubYahoo(() => new Response("{}"));
    const { env, h } = await auth();
    const res = await worker.fetch(req(path, { headers: h }), env);
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("Yahoo 404 verirse 404 döner", async () => {
    stubYahoo(() => new Response("", { status: 404 }));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/chart?symbol=ZZZZ&period=1g", { headers: h }), env);
    expect(res.status).toBe(404);
  });

  it("Yahoo çökerse 502 döner", async () => {
    stubYahoo(() => new Response("", { status: 500 }));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/chart?symbol=THYAO&period=1g", { headers: h }), env);
    expect(res.status).toBe(502);
  });

  it("POST kabul etmez", async () => {
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/chart?symbol=THYAO", { method: "POST", headers: h }), env);
    expect(res.status).toBe(405);
  });
});

describe("/api/search", () => {
  const found = { quotes: [{ symbol: "THYAO.IS", quoteType: "EQUITY", longname: "Turk Hava Yollari" }] };

  it("giriş gerektirir", async () => {
    const res = await worker.fetch(req("/api/search?q=thy"), makeEnv());
    expect(res.status).toBe(401);
  });

  it("sonuçları döndürür", async () => {
    stubYahoo(() => new Response(JSON.stringify(found)));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/search?q=turk%20hava", { headers: h }), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ symbol: "THYAO", name: "Turk Hava Yollari" }] });
  });

  it.each(["", "a", "x".repeat(41)])("uygunsuz uzunlukta sorgu 400: %j", async (q) => {
    const f = stubYahoo(() => new Response("{}"));
    const { env, h } = await auth();
    const res = await worker.fetch(req(`/api/search?q=${q}`, { headers: h }), env);
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("Yahoo çökerse 502 döner", async () => {
    stubYahoo(() => { throw new Error("ağ"); });
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/search?q=thy", { headers: h }), env);
    expect(res.status).toBe(502);
  });
});

describe("/api/quotes", () => {
  const q = (price: number) => ({
    chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: 100, regularMarketVolume: 5000 } }], error: null },
  });
  const byUrl = (map: Record<string, Response | (() => Response)>) =>
    stubYahoo((u) => {
      const hit = Object.keys(map).find((k) => u.includes(`/${k}.IS`));
      if (!hit) return new Response("", { status: 404 });
      const v = map[hit];
      return typeof v === "function" ? v() : v;
    });

  it("giriş gerektirir", async () => {
    const res = await worker.fetch(req("/api/quotes?symbols=THYAO"), makeEnv());
    expect(res.status).toBe(401);
  });

  it("birden çok hissenin fiyatını döndürür", async () => {
    byUrl({ THYAO: new Response(JSON.stringify(q(110))), GARAN: new Response(JSON.stringify(q(55))) });
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/quotes?symbols=thyao,garan", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.quotes).toEqual([
      { symbol: "THYAO", price: 110, prevClose: 100, volume: 5000 },
      { symbol: "GARAN", price: 55, prevClose: 100, volume: 5000 },
    ]);
    expect(body.failed).toEqual([]);
  });

  it("biri bulunamazsa diğerleri yine döner, bulunamayan failed'a girer", async () => {
    byUrl({ THYAO: new Response(JSON.stringify(q(110))) });
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/quotes?symbols=THYAO,ZZZZ", { headers: h }), env);
    const body: any = await res.json();
    expect(body.quotes).toHaveLength(1);
    expect(body.failed).toEqual(["ZZZZ"]);
  });

  it("tekrarlı sembolü bir kez sorar", async () => {
    const f = stubYahoo(() => new Response(JSON.stringify(q(1))));
    const { env, h } = await auth();
    await worker.fetch(req("/api/quotes?symbols=THYAO,THYAO,thyao", { headers: h }), env);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("Yahoo tamamen çökerse 502", async () => {
    stubYahoo(() => new Response("", { status: 500 }));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/quotes?symbols=THYAO,GARAN", { headers: h }), env);
    expect(res.status).toBe(502);
  });

  it.each([
    ["boş", "/api/quotes?symbols="],
    ["parametre yok", "/api/quotes"],
    ["geçersiz sembol", "/api/quotes?symbols=TH/YAO"],
    [`${20 + 1} sembol`, `/api/quotes?symbols=${Array.from({ length: 21 }, (_, i) => `AA${String(i).padStart(2, "0")}`).join(",")}`],
  ])("geçersiz istek 400: %s", async (_n, path) => {
    const f = stubYahoo(() => new Response("{}"));
    const { env, h } = await auth();
    const res = await worker.fetch(req(path, { headers: h }), env);
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("/api/favorites", () => {
  it("giriş gerektirir", async () => {
    expect((await worker.fetch(req("/api/favorites"), makeEnv())).status).toBe(401);
    expect((await worker.fetch(req("/api/favorites", { method: "PUT", body: "{}" }), makeEnv())).status).toBe(401);
  });

  it("kayıt yoksa boş liste döner", async () => {
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/favorites", { headers: h }), env);
    expect(await res.json()).toEqual({ symbols: [] });
  });

  it("kaydeder ve geri okur (sıra korunur)", async () => {
    const { env, h } = await auth();
    const put = await worker.fetch(
      req("/api/favorites", { method: "PUT", headers: h, body: JSON.stringify({ symbols: ["THYAO", "GARAN"] }) }),
      env,
    );
    expect(put.status).toBe(200);
    const get = await worker.fetch(req("/api/favorites", { headers: h }), env);
    expect(await get.json()).toEqual({ symbols: ["THYAO", "GARAN"] });
  });

  it("geçersiz gövdede 400 verir ve eski kaydı bozmaz", async () => {
    const { env, h } = await auth();
    await worker.fetch(req("/api/favorites", { method: "PUT", headers: h, body: JSON.stringify({ symbols: ["THYAO"] }) }), env);
    const bad = await worker.fetch(req("/api/favorites", { method: "PUT", headers: h, body: JSON.stringify({ symbols: ["x/y"] }) }), env);
    expect(bad.status).toBe(400);
    const get = await worker.fetch(req("/api/favorites", { headers: h }), env);
    expect(await get.json()).toEqual({ symbols: ["THYAO"] });
  });

  it("bozuk JSON'da 400", async () => {
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/favorites", { method: "PUT", headers: h, body: "{{" }), env);
    expect(res.status).toBe(400);
  });

  it("çok büyük gövdede 413", async () => {
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/favorites", { method: "PUT", headers: h, body: "x".repeat(6000) }), env);
    expect(res.status).toBe(413);
  });

  it("DELETE kabul etmez", async () => {
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/favorites", { method: "DELETE", headers: h }), env)).status).toBe(405);
  });
});

describe("/api/market", () => {
  const q = (price: number) => ({
    chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: price - 1 } }], error: null },
  });

  it("giriş gerektirir", async () => {
    expect((await worker.fetch(req("/api/market"), makeEnv())).status).toBe(401);
  });

  it("sabit listedeki sekiz kalemi etiket ve ondalıkla döndürür", async () => {
    const f = stubYahoo(() => new Response(JSON.stringify(q(100))));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/market", { headers: h }), env);
    const body: any = await res.json();
    expect(body.items).toHaveLength(8);
    expect(body.items[0]).toEqual({ key: "XU100", label: "BIST 100", decimals: 2, price: 100, prevClose: 99 });
    expect(body.items.find((i: any) => i.key === "USDTRY").decimals).toBe(4);
    expect(f).toHaveBeenCalledTimes(8);
  });

  it("Yahoo sembollerini doğru biçimde (kodlanmış ^ ve =X) ister", async () => {
    const f = stubYahoo(() => new Response(JSON.stringify(q(1))));
    const { env, h } = await auth();
    await worker.fetch(req("/api/market", { headers: h }), env);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/chart/%5EGSPC?"))).toBe(true);
    expect(urls.some((u) => u.includes("/chart/USDTRY%3DX?"))).toBe(true);
    expect(urls.some((u) => u.includes("/chart/XU100.IS?"))).toBe(true);
  });

  it("biri düşerse o kalem null olur, diğerleri döner", async () => {
    stubYahoo((u) => (u.includes("GC%3DF") ? new Response("", { status: 404 }) : new Response(JSON.stringify(q(50)))));
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/market", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    const gold = body.items.find((i: any) => i.key === "GOLD");
    expect(gold.price).toBeNull();
    expect(body.items.filter((i: any) => i.price !== null)).toHaveLength(7);
  });

  it("hiçbiri gelmezse 502", async () => {
    stubYahoo(() => new Response("", { status: 500 }));
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/market", { headers: h }), env)).status).toBe(502);
  });

  it("POST kabul etmez", async () => {
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/market", { method: "POST", headers: h }), env)).status).toBe(405);
  });
});
