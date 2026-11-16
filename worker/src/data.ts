import { getFundamentals } from "./fundamentals";
import { MARKET_ITEMS } from "./market";
import { YahooError, getChart, getQuote, getQuoteRaw, isPeriod, searchSymbols, type Quote } from "./yahoo";

const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;
const CHART_TTL = 10; // sn — arayüz 15 sn'de bir yeniler, aynı hisse çok açılırsa Yahoo'ya gitmesin
const SEARCH_TTL = 300;

function json(body: unknown, status = 200, ttl = 0): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
  if (ttl > 0) headers["Cache-Control"] = `public, max-age=${ttl}`;
  return new Response(JSON.stringify(body), { status, headers });
}

// Cloudflare önbelleği varsa kullan (testte ve yerelde yok → doğrudan çalışır). Yalnız başarılı yanıtlar saklanır.
async function cached(request: Request, ttl: number, produce: () => Promise<Response>): Promise<Response> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(request.url, { method: "GET" }); // Authorization başlığı anahtara girmesin
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await produce();
  if (cache && res.ok && ttl > 0) await cache.put(key, res.clone());
  return res;
}

function mapError(e: unknown): Response {
  if (e instanceof YahooError && e.kind === "notfound") return json({ error: "Hisse bulunamadı" }, 404);
  return json({ error: "Veri kaynağına ulaşılamadı" }, 502);
}

export async function handleChart(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Yöntem desteklenmiyor" }, 405);
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
  const period = url.searchParams.get("period") ?? "1g";
  if (!SYMBOL_RE.test(symbol)) return json({ error: "Geçersiz sembol" }, 400);
  if (!isPeriod(period)) return json({ error: "Geçersiz dönem" }, 400);

  return cached(request, CHART_TTL, async () => {
    try {
      return json(await getChart(symbol, period), 200, CHART_TTL);
    } catch (e) {
      return mapError(e);
    }
  });
}

export async function handleSearch(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Yöntem desteklenmiyor" }, 405);
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 40) return json({ error: "Arama en az 2, en çok 40 karakter olmalı" }, 400);

  return cached(request, SEARCH_TTL, async () => {
    try {
      return json({ results: await searchSymbols(q) }, 200, SEARCH_TTL);
    } catch (e) {
      return mapError(e);
    }
  });
}

// Workers ücretsiz planında istek başına 50 alt istek sınırı var → tek çağrıda en fazla 20 hisse.
export const MAX_QUOTES = 20;
const QUOTES_TTL = 10;

export async function handleQuotes(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Yöntem desteklenmiyor" }, 405);
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.toUpperCase().split(",").filter(Boolean))];
  if (symbols.length === 0) return json({ error: "symbols gerekli" }, 400);
  if (symbols.length > MAX_QUOTES) return json({ error: `En fazla ${MAX_QUOTES} sembol` }, 400);
  if (!symbols.every((s) => SYMBOL_RE.test(s))) return json({ error: "Geçersiz sembol" }, 400);

  return cached(request, QUOTES_TTL, async () => {
    const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
    const quotes: Quote[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => (r.status === "fulfilled" ? quotes.push(r.value) : failed.push(symbols[i])));
    // Hepsi düştüyse Yahoo'ya ulaşılamıyor demektir; tek tük hata ise başarılı olanlar döner.
    if (quotes.length === 0 && failed.length > 0) {
      const allNotFound = results.every((r) => r.status === "rejected" && r.reason instanceof YahooError && r.reason.kind === "notfound");
      return allNotFound ? json({ quotes, failed }, 200, QUOTES_TTL) : json({ error: "Veri kaynağına ulaşılamadı" }, 502);
    }
    return json({ quotes, failed }, 200, QUOTES_TTL);
  });
}

export async function handleMarket(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Yöntem desteklenmiyor" }, 405);
  return cached(request, QUOTES_TTL, async () => {
    const results = await Promise.allSettled(MARKET_ITEMS.map((m) => getQuoteRaw(m.yahoo, m.key)));
    const items = MARKET_ITEMS.map((m, i) => {
      const r = results[i];
      const q = r.status === "fulfilled" ? r.value : null;
      return { key: m.key, label: m.label, decimals: m.decimals, price: q?.price ?? null, prevClose: q?.prevClose ?? null };
    });
    // Hiçbiri gelmediyse Yahoo'ya ulaşılamıyordur; tek tük eksik varsa kart yine de döner.
    if (results.every((r) => r.status === "rejected")) return json({ error: "Veri kaynağına ulaşılamadı" }, 502);
    return json({ items }, 200, QUOTES_TTL);
  });
}

const FUNDAMENTALS_TTL = 3600; // temel veri yavaş değişir → 1 saat

export async function handleFundamentals(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Yöntem desteklenmiyor" }, 405);
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return json({ error: "Geçersiz sembol" }, 400);
  return cached(request, FUNDAMENTALS_TTL, async () => {
    try {
      return json(await getFundamentals(symbol), 200, FUNDAMENTALS_TTL);
    } catch (e) {
      return mapError(e);
    }
  });
}
