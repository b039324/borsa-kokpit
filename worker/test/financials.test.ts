import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { getFinancials, normalizeFinancials } from "../src/financials";
import { resetCrumbCache } from "../src/fundamentals";
import { makeEnv, req, loginReq } from "./helpers";

const entry = (date: string, v: number | null, cur = "TRY") =>
  v === null ? null : { dataId: 1, asOfDate: date, periodType: "12M", currencyCode: cur, reportedValue: { raw: v, fmt: String(v) } };
const series = (type: string, list: unknown[]) => ({ meta: { symbol: ["THYAO.IS"], type: [type] }, timestamp: [], [type]: list });
const wrap = (...results: unknown[]) => ({ timeseries: { result: results, error: null } });

const sample = wrap(
  series("annualTotalRevenue", [entry("2021-12-31", 100), entry("2022-12-31", 120), entry("2023-12-31", 150)]),
  series("annualNetIncome", [entry("2021-12-31", 10), entry("2022-12-31", -5), entry("2023-12-31", 30)]),
  series("annualGrossProfit", [entry("2022-12-31", 40), entry("2023-12-31", 50)]),
  series("annualOperatingIncome", [entry("2023-12-31", 25)]),
  series("quarterlyTotalRevenue", [entry("2024-03-31", 40), entry("2024-06-30", 45)]),
  series("quarterlyNetIncome", [entry("2024-03-31", 8), entry("2024-06-30", 9)]),
);

describe("normalizeFinancials", () => {
  it("yıllık dönemleri eskiden yeniye, dört kalemle döndürür; eksik kalem null olur", () => {
    const f = normalizeFinancials(sample, "THYAO");
    expect(f.symbol).toBe("THYAO");
    expect(f.currency).toBe("TRY");
    expect(f.annual.map((p) => p.date)).toEqual(["2021-12-31", "2022-12-31", "2023-12-31"]);
    expect(f.annual[2]).toEqual({ date: "2023-12-31", revenue: 150, grossProfit: 50, operatingIncome: 25, netIncome: 30 });
    expect(f.annual[0]).toEqual({ date: "2021-12-31", revenue: 100, grossProfit: null, operatingIncome: null, netIncome: 10 });
    expect(f.annual[1].netIncome).toBe(-5);
  });

  it("çeyreklik dönemleri ayrı listeler", () => {
    const f = normalizeFinancials(sample, "THYAO");
    expect(f.quarterly.map((p) => p.date)).toEqual(["2024-03-31", "2024-06-30"]);
    expect(f.quarterly[1]).toMatchObject({ revenue: 45, netIncome: 9, grossProfit: null });
  });

  it("yıllıkta son 5, çeyrekte son 8 dönemi tutar", () => {
    const years = Array.from({ length: 8 }, (_, i) => entry(`${2016 + i}-12-31`, 100 + i));
    const quarters = Array.from({ length: 12 }, (_, i) => entry(`${2021 + Math.floor(i / 4)}-${["03-31", "06-30", "09-30", "12-31"][i % 4]}`, 10 + i));
    const f = normalizeFinancials(wrap(series("annualTotalRevenue", years), series("quarterlyTotalRevenue", quarters)), "X");
    expect(f.annual).toHaveLength(5);
    expect(f.annual[0].date).toBe("2019-12-31");
    expect(f.annual[4].date).toBe("2023-12-31");
    expect(f.quarterly).toHaveLength(8);
    expect(f.quarterly[7].date).toBe("2023-12-31");
  });

  it("boş (null) girdileri atlar; tüm kalemleri boş dönemi listelemez", () => {
    const f = normalizeFinancials(wrap(series("annualTotalRevenue", [entry("2022-12-31", null), entry("2023-12-31", 7)])), "X");
    expect(f.annual).toEqual([{ date: "2023-12-31", revenue: 7, grossProfit: null, operatingIncome: null, netIncome: null }]);
  });

  it("verisi olmayan türler (anahtar yok) sorun çıkarmaz; hiç veri yoksa boş listeler döner", () => {
    const empty = normalizeFinancials(wrap({ meta: { symbol: ["X.IS"], type: ["annualTotalRevenue"] }, timestamp: [] }), "X");
    expect(empty).toEqual({ symbol: "X", currency: null, annual: [], quarterly: [] });
    expect(normalizeFinancials({ timeseries: { result: null, error: null } }, "X").annual).toEqual([]);
  });

  it("Yahoo 'Not Found' hatasında notfound fırlatır", () => {
    expect(() => normalizeFinancials({ timeseries: { result: null, error: { code: "Not Found", description: "x" } } }, "X")).toThrow();
  });

  it("sayı olmayan değerleri null sayar", () => {
    const bad = { dataId: 1, asOfDate: "2023-12-31", currencyCode: "TRY", reportedValue: { raw: "abc" } };
    const f = normalizeFinancials(wrap(series("annualTotalRevenue", [bad, entry("2022-12-31", 5)])), "X");
    expect(f.annual.map((p) => p.date)).toEqual(["2022-12-31"]);
  });
});

function fakeYahoo(opts: { statuses?: number[]; crumbStatus?: number } = {}) {
  const statuses = [...(opts.statuses ?? [200])];
  const calls: { url: string; cookie?: string }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const cookie = (init?.headers as Record<string, string> | undefined)?.Cookie;
    calls.push({ url, cookie });
    if (url.startsWith("https://fc.yahoo.com")) {
      return new Response("", { status: 404, headers: { "set-cookie": "A3=d=ABC123&S=xyz; Path=/" } });
    }
    if (url.includes("/v1/test/getcrumb")) return new Response("CRUMB/1", { status: opts.crumbStatus ?? 200 });
    const status = statuses.shift() ?? 200;
    if (status !== 200) return new Response("{}", { status });
    return new Response(JSON.stringify(sample), { status: 200 });
  });
  return { f, calls };
}

describe("getFinancials", () => {
  beforeEach(() => resetCrumbCache());

  it("önce crumb'sız dener; sekiz türü ve tarih aralığını ister", async () => {
    const { f, calls } = fakeYahoo();
    const out = await getFinancials("THYAO", f as any, 1_700_000_000_000);
    expect(out.annual).toHaveLength(3);
    expect(calls).toHaveLength(1);
    const u = calls[0].url;
    expect(u).toContain("/ws/fundamentals-timeseries/v1/finance/timeseries/THYAO.IS");
    for (const t of ["annualTotalRevenue", "annualGrossProfit", "annualOperatingIncome", "annualNetIncome", "quarterlyTotalRevenue", "quarterlyGrossProfit", "quarterlyOperatingIncome", "quarterlyNetIncome"]) {
      expect(u).toContain(t);
    }
    const p1 = Number(/period1=(\d+)/.exec(u)![1]);
    const p2 = Number(/period2=(\d+)/.exec(u)![1]);
    expect(p2).toBe(1_700_000_000);
    expect(p1).toBeLessThan(p2 - 5 * 365 * 86400);
  });

  it("401 gelirse crumb alıp yeniden dener", async () => {
    const { f, calls } = fakeYahoo({ statuses: [401, 200] });
    const out = await getFinancials("THYAO", f as any);
    expect(out.annual).toHaveLength(3);
    const last = calls.at(-1)!;
    expect(last.url).toContain("crumb=CRUMB%2F1");
    expect(last.cookie).toContain("A3=d=ABC123");
  });

  it("ısrarlı 401 → upstream, 404 → notfound, crumb alınamazsa upstream", async () => {
    await expect(getFinancials("THYAO", fakeYahoo({ statuses: [401, 401] }).f as any)).rejects.toMatchObject({ kind: "upstream" });
    resetCrumbCache();
    await expect(getFinancials("ZZZZ", fakeYahoo({ statuses: [404] }).f as any)).rejects.toMatchObject({ kind: "notfound" });
    resetCrumbCache();
    await expect(getFinancials("THYAO", fakeYahoo({ statuses: [401], crumbStatus: 429 }).f as any)).rejects.toMatchObject({ kind: "upstream" });
  });
});

describe("/api/financials", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => resetCrumbCache());

  async function auth() {
    const env = makeEnv();
    const res = await worker.fetch(loginReq("dogru-sifre"), env);
    const { token } = (await res.json()) as { token: string };
    return { env, h: { Authorization: `Bearer ${token}` } };
  }

  it("giriş olmadan 401, Yahoo'ya gidilmez", async () => {
    const f = fakeYahoo().f;
    vi.stubGlobal("fetch", f);
    expect((await worker.fetch(req("/api/financials?symbol=THYAO"), makeEnv())).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("geçersiz sembol 400, POST 405", async () => {
    vi.stubGlobal("fetch", fakeYahoo().f);
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/financials?symbol=../x", { headers: h }), env)).status).toBe(400);
    expect((await worker.fetch(req("/api/financials?symbol=THYAO", { method: "POST", headers: h }), env)).status).toBe(405);
  });

  it("verileri döndürür (küçük harfli sembol büyütülür)", async () => {
    vi.stubGlobal("fetch", fakeYahoo().f);
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/financials?symbol=thyao", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.symbol).toBe("THYAO");
    expect(body.annual[2].netIncome).toBe(30);
  });

  it("Yahoo bulunamazsa 404, erişilemezse 502", async () => {
    const { env, h } = await auth();
    vi.stubGlobal("fetch", fakeYahoo({ statuses: [404] }).f);
    expect((await worker.fetch(req("/api/financials?symbol=ZZZZ", { headers: h }), env)).status).toBe(404);
    resetCrumbCache();
    vi.stubGlobal("fetch", fakeYahoo({ statuses: [500, 500] }).f);
    expect((await worker.fetch(req("/api/financials?symbol=THYAO", { headers: h }), env)).status).toBe(502);
  });
});
