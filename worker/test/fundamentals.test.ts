import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { getFundamentals, normalizeFundamentals, resetCrumbCache } from "../src/fundamentals";
import { makeEnv, req, loginReq } from "./helpers";

const r = (raw: number) => ({ raw, fmt: String(raw) }); // Yahoo {raw, fmt} biçimi
const summary = {
  quoteSummary: {
    error: null,
    result: [
      {
        price: { longName: "Turk Hava Yollari A.O.", currency: "TRY", marketCap: r(450_000_000_000) },
        summaryDetail: {
          trailingPE: r(4.2),
          forwardPE: r(5.1),
          dividendYield: r(0.021),
          beta: r(1.12),
          fiftyTwoWeekHigh: r(340),
          fiftyTwoWeekLow: r(250),
          fiftyDayAverage: r(300),
          twoHundredDayAverage: r(310),
          priceToSalesTrailing12Months: r(0.9),
        },
        defaultKeyStatistics: { priceToBook: r(1.1), trailingEps: r(70), bookValue: r(260), enterpriseToEbitda: r(3.2) },
        financialData: {
          returnOnEquity: r(0.28),
          returnOnAssets: r(0.1),
          profitMargins: r(0.15),
          operatingMargins: r(0.12),
          grossMargins: r(0.3),
          debtToEquity: r(95.5),
          currentRatio: r(1.3),
          revenueGrowth: r(0.2),
          earningsGrowth: r(-0.1),
        },
      },
    ],
  },
};

describe("normalizeFundamentals", () => {
  it("Yahoo {raw} değerlerini düz sayılara çevirir", () => {
    const f = normalizeFundamentals(summary, "THYAO");
    expect(f.symbol).toBe("THYAO");
    expect(f.name).toBe("Turk Hava Yollari A.O.");
    expect(f.currency).toBe("TRY");
    expect(f.marketCap).toBe(450_000_000_000);
    expect(f.trailingPE).toBe(4.2);
    expect(f.priceToBook).toBe(1.1);
    expect(f.dividendYield).toBe(0.021);
    expect(f.returnOnEquity).toBe(0.28);
    expect(f.debtToEquity).toBe(95.5);
    expect(f.earningsGrowth).toBe(-0.1);
    expect(f.fiftyTwoWeekLow).toBe(250);
  });

  it("düz sayıları da kabul eder, eksik alanlar null olur", () => {
    const f = normalizeFundamentals({ quoteSummary: { result: [{ summaryDetail: { trailingPE: 7 } }] } }, "X");
    expect(f.trailingPE).toBe(7);
    expect(f.priceToBook).toBeNull();
    expect(f.name).toBeNull();
  });

  it("sonuç yoksa notfound hatası", () => {
    expect(() => normalizeFundamentals({ quoteSummary: { result: null, error: { code: "Not Found" } } }, "X")).toThrow(/Bulunamadı|bulunamadı/);
  });
});

function fakeYahoo(opts: { crumbStatus?: number; summaryStatuses?: number[] } = {}) {
  const summaryStatuses = [...(opts.summaryStatuses ?? [200])];
  const calls: { url: string; cookie?: string }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const cookie = (init?.headers as Record<string, string> | undefined)?.Cookie;
    calls.push({ url, cookie });
    if (url.startsWith("https://fc.yahoo.com")) {
      return new Response("", { status: 404, headers: { "set-cookie": "A3=d=ABC123&S=xyz; Expires=Wed, 01 Jan 2030; Domain=.yahoo.com; Path=/" } });
    }
    if (url.includes("/v1/test/getcrumb")) return new Response("CRUMB/1", { status: opts.crumbStatus ?? 200 });
    const status = summaryStatuses.shift() ?? 200;
    if (status !== 200) return new Response("{}", { status });
    return new Response(JSON.stringify(summary), { status: 200 });
  });
  return { f, calls };
}

describe("getFundamentals", () => {
  beforeEach(() => resetCrumbCache());

  it("çerez ve crumb alıp quoteSummary'yi çağırır", async () => {
    const { f, calls } = fakeYahoo();
    const out = await getFundamentals("THYAO", f as any);
    expect(out.trailingPE).toBe(4.2);
    const crumbCall = calls.find((c) => c.url.includes("getcrumb"))!;
    expect(crumbCall.cookie).toContain("A3=d=ABC123");
    const sumCall = calls.find((c) => c.url.includes("quoteSummary"))!;
    expect(sumCall.url).toContain("THYAO.IS");
    expect(sumCall.url).toContain("crumb=CRUMB%2F1");
    expect(sumCall.url).toContain("modules=");
    expect(sumCall.cookie).toContain("A3=");
  });

  it("crumb önbelleğe alınır: ikinci çağrıda yeniden istenmez", async () => {
    const { f, calls } = fakeYahoo();
    await getFundamentals("THYAO", f as any);
    await getFundamentals("GARAN", f as any);
    expect(calls.filter((c) => c.url.includes("getcrumb"))).toHaveLength(1);
  });

  it("401 gelirse crumb'ı yenileyip bir kez daha dener", async () => {
    const { f, calls } = fakeYahoo({ summaryStatuses: [401, 200] });
    const out = await getFundamentals("THYAO", f as any);
    expect(out.trailingPE).toBe(4.2);
    expect(calls.filter((c) => c.url.includes("getcrumb"))).toHaveLength(2);
  });

  it("ısrarlı 401 → upstream hatası", async () => {
    const { f } = fakeYahoo({ summaryStatuses: [401, 401] });
    await expect(getFundamentals("THYAO", f as any)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("404 → notfound", async () => {
    const { f } = fakeYahoo({ summaryStatuses: [404] });
    await expect(getFundamentals("ZZZZ", f as any)).rejects.toMatchObject({ kind: "notfound" });
  });

  it("crumb alınamazsa upstream hatası", async () => {
    const { f } = fakeYahoo({ crumbStatus: 429 });
    await expect(getFundamentals("THYAO", f as any)).rejects.toMatchObject({ kind: "upstream" });
  });
});

describe("/api/fundamentals", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => resetCrumbCache());

  async function auth() {
    const env = makeEnv();
    const res = await worker.fetch(loginReq("dogru-sifre"), env);
    const { token } = (await res.json()) as { token: string };
    return { env, h: { Authorization: `Bearer ${token}` } };
  }

  it("giriş olmadan 401", async () => {
    const f = fakeYahoo().f;
    vi.stubGlobal("fetch", f);
    const res = await worker.fetch(req("/api/fundamentals?symbol=THYAO"), makeEnv());
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("geçersiz sembol 400", async () => {
    vi.stubGlobal("fetch", fakeYahoo().f);
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/fundamentals?symbol=../x", { headers: h }), env);
    expect(res.status).toBe(400);
  });

  it("verileri döndürür", async () => {
    vi.stubGlobal("fetch", fakeYahoo().f);
    const { env, h } = await auth();
    const res = await worker.fetch(req("/api/fundamentals?symbol=thyao", { headers: h }), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.symbol).toBe("THYAO");
    expect(body.trailingPE).toBe(4.2);
  });

  it("Yahoo erişilemezse 502, bulunamazsa 404", async () => {
    vi.stubGlobal("fetch", fakeYahoo({ crumbStatus: 500 }).f);
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/fundamentals?symbol=THYAO", { headers: h }), env)).status).toBe(502);
    resetCrumbCache();
    vi.stubGlobal("fetch", fakeYahoo({ summaryStatuses: [404] }).f);
    expect((await worker.fetch(req("/api/fundamentals?symbol=ZZZZ", { headers: h }), env)).status).toBe(404);
  });
});
