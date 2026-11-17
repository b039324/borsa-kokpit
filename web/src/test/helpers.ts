import { vi } from "vitest";

type Reply = { status: number; body?: unknown } | Error;

export function mockFetch(handler: (url: string, init?: RequestInit) => Reply) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const reply = handler(String(input), init);
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const TOKEN_KEY = "kokpit_token";

interface ApiMockOptions {
  favorites?: string[];
  alarms?: unknown[];
  alarmsGetStatus?: number;
  market?: unknown[];
  quotes?: Record<string, { price: number; prevClose: number; volume?: number }>;
  stats?: Record<string, { price?: number; prevClose?: number; volume?: number; avgVolume?: number; vol?: number }>;
  statsGetStatus?: number;
  layout?: unknown;
  layoutGetStatus?: number;
  // Her PUT için sırayla dönecek durum kodları (bitince 200)
  putStatuses?: number[];
}

// /api/me ve /api/layout için sahte Worker. PUT gövdeleri `puts` içinde toplanır.
export function apiMock(opts: ApiMockOptions = {}) {
  const puts: any[] = [];
  const favPuts: string[][] = [];
  const alarmPuts: any[][] = [];
  let putCall = 0;
  const fn = mockFetch((url, init) => {
    if (url.endsWith("/api/me")) return { status: 200, body: { ok: true } };
    if (url.endsWith("/api/market")) return { status: 200, body: { items: opts.market ?? [] } };
    if (url.endsWith("/api/alarms")) {
      if (init?.method === "PUT") {
        alarmPuts.push(JSON.parse(String(init.body)).alarms);
        return { status: 200, body: { ok: true } };
      }
      return { status: opts.alarmsGetStatus ?? 200, body: { alarms: opts.alarms ?? [] } };
    }
    if (url.endsWith("/api/favorites")) {
      if (init?.method === "PUT") {
        favPuts.push(JSON.parse(String(init.body)).symbols);
        return { status: 200, body: { ok: true } };
      }
      return { status: 200, body: { symbols: opts.favorites ?? [] } };
    }
    if (url.includes("/api/stats")) {
      const want = decodeURIComponent(url.split("symbols=")[1] ?? "").split(",");
      const st = opts.stats ?? {};
      const stats = want
        .filter((x) => st[x])
        .map((x) => ({ symbol: x, price: null, prevClose: null, volume: null, avgVolume: null, vol: null, ...st[x] }));
      return { status: opts.statsGetStatus ?? 200, body: { stats, failed: want.filter((x) => !st[x]) } };
    }
    if (url.includes("/api/quotes")) {
      const want = decodeURIComponent(url.split("symbols=")[1] ?? "").split(",");
      const quotes = want.filter((s) => opts.quotes?.[s]).map((s) => ({ symbol: s, ...opts.quotes![s] }));
      return { status: 200, body: { quotes, failed: want.filter((s) => !opts.quotes?.[s]) } };
    }
    if (url.endsWith("/api/layout")) {
      if (init?.method === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        const status = opts.putStatuses?.[putCall++] ?? 200;
        return { status, body: status === 200 ? { ok: true } : { error: "hata" } };
      }
      return { status: opts.layoutGetStatus ?? 200, body: { layout: opts.layout ?? null } };
    }
    return { status: 404 };
  });
  const gets = () => fn.mock.calls.filter(([u, i]) => String(u).endsWith("/api/layout") && !i?.method);
  return { fn, puts, gets, favPuts, alarmPuts };
}
