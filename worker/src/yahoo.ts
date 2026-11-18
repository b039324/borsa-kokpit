import { MARKET_ITEMS } from "./market";

// Yahoo Finance (resmi olmayan) istemcisi. Fetch dışarıdan verilebilir → testte sahte yanıt kullanılır.

export type PeriodKey = "1g" | "1h" | "1a" | "3a" | "6a" | "1y" | "5y";

interface PeriodDef {
  range: string;
  interval: string;
  aggregate?: number; // saatlik mumları kaç tanesi birleştirilecek (4 saatlik için gün içi 2 kova)
}

// Kullanıcının mum tablosu: gün içi 5dk, hafta 1sa, ay 4sa, 3ay gün, 6ay hafta, 1yıl hafta, 5yıl ay.
export const PERIODS: Record<PeriodKey, PeriodDef> = {
  "1g": { range: "1d", interval: "5m" },
  "1h": { range: "5d", interval: "60m" },
  "1a": { range: "1mo", interval: "60m", aggregate: 4 },
  "3a": { range: "3mo", interval: "1d" },
  "6a": { range: "6mo", interval: "1wk" },
  "1y": { range: "1y", interval: "1wk" },
  "5y": { range: "5y", interval: "1mo" },
};

export function isPeriod(v: string): v is PeriodKey {
  return Object.prototype.hasOwnProperty.call(PERIODS, v);
}

export interface Candle {
  t: number; // saniye (unix)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ChartResult {
  symbol: string;
  period: PeriodKey;
  currency: string | null;
  price: number | null;
  prevClose: number | null;
  gmtoffset: number;
  candles: Candle[];
}

export class YahooError extends Error {
  constructor(
    public kind: "notfound" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; borsa-kokpit)", Accept: "application/json" };

// query1 olmazsa query2 denenir. 404 "bulunamadı" demektir, yedeğe geçilmez.
export async function getJson(path: string, f: FetchLike): Promise<any> {
  let last = "bilinmeyen hata";
  for (const host of HOSTS) {
    try {
      const res = await f(host + path, { headers: HEADERS });
      if (res.status === 404) throw new YahooError("notfound", "Bulunamadı");
      if (!res.ok) {
        last = `Yahoo ${res.status}`;
        continue;
      }
      return await res.json();
    } catch (e) {
      if (e instanceof YahooError) throw e;
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new YahooError("upstream", last);
}

// Piyasa kalemleri (USDTRY, GOLD, SP500…) kendi Yahoo sembolüne çevrilir; geri kalanı BIST hissesidir.
const toYahoo = (symbol: string) => MARKET_ITEMS.find((m) => m.key === symbol)?.yahoo ?? `${symbol}.IS`;

export function normalizeChart(raw: any, symbol: string, period: PeriodKey): ChartResult {
  const err = raw?.chart?.error;
  if (err) {
    throw new YahooError(err.code === "Not Found" ? "notfound" : "upstream", err.description ?? "Yahoo hatası");
  }
  const r = raw?.chart?.result?.[0];
  if (!r) throw new YahooError("notfound", "Veri yok");

  const q = r.indicators?.quote?.[0] ?? {};
  const ts: number[] = r.timestamp ?? [];
  const gmtoffset: number = r.meta?.gmtoffset ?? 10800;
  let candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((x) => typeof x !== "number" || !Number.isFinite(x))) continue; // boş mumları atla
    candles.push({ t: ts[i], o, h, l, c, v: q.volume?.[i] ?? 0 });
  }

  const agg = PERIODS[period].aggregate;
  if (agg) candles = aggregateSessions(candles, gmtoffset);

  return {
    symbol,
    period,
    currency: r.meta?.currency ?? null,
    price: r.meta?.regularMarketPrice ?? null,
    prevClose: r.meta?.chartPreviousClose ?? r.meta?.previousClose ?? null,
    gmtoffset,
    candles,
  };
}

// Saatlik mumlardan 4 saatlik üret: BIST seansı 10:00–18:00 → her gün iki kova (10–13 ve 14–17, yerel saat).
export function aggregateSessions(candles: Candle[], gmtoffset: number): Candle[] {
  const out: Candle[] = [];
  let key = "";
  for (const c of candles) {
    const local = new Date((c.t + gmtoffset) * 1000);
    const day = local.toISOString().slice(0, 10);
    const k = `${day}-${local.getUTCHours() < 14 ? "a" : "b"}`;
    const last = out[out.length - 1];
    if (k === key && last) {
      last.h = Math.max(last.h, c.h);
      last.l = Math.min(last.l, c.l);
      last.c = c.c;
      last.v += c.v;
    } else {
      out.push({ ...c });
      key = k;
    }
  }
  return out;
}

export async function getChart(symbol: string, period: PeriodKey, f: FetchLike = fetch): Promise<ChartResult> {
  const p = PERIODS[period];
  const path = `/v8/finance/chart/${encodeURIComponent(toYahoo(symbol))}?range=${p.range}&interval=${p.interval}&includePrePost=false`;
  return normalizeChart(await getJson(path, f), symbol, period);
}

export interface SearchHit {
  symbol: string;
  name: string;
}

export function normalizeSearch(raw: any): SearchHit[] {
  const quotes: any[] = raw?.quotes ?? [];
  const hits: SearchHit[] = [];
  for (const x of quotes) {
    if (x?.quoteType !== "EQUITY" || typeof x.symbol !== "string" || !x.symbol.endsWith(".IS")) continue;
    hits.push({ symbol: x.symbol.slice(0, -3), name: String(x.longname ?? x.shortname ?? x.symbol) });
  }
  return hits;
}

export async function searchSymbols(q: string, f: FetchLike = fetch): Promise<SearchHit[]> {
  const path = `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&lang=tr-TR&region=TR`;
  return normalizeSearch(await getJson(path, f));
}

export interface Quote {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  volume: number | null; // gün içi toplam lot
}

export function normalizeQuote(raw: any, symbol: string): Quote {
  const err = raw?.chart?.error;
  if (err) throw new YahooError(err.code === "Not Found" ? "notfound" : "upstream", err.description ?? "Yahoo hatası");
  const m = raw?.chart?.result?.[0]?.meta;
  if (!m) throw new YahooError("notfound", "Veri yok");
  return {
    symbol,
    price: typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : null,
    prevClose: typeof m.chartPreviousClose === "number" ? m.chartPreviousClose : null,
    volume: typeof m.regularMarketVolume === "number" ? m.regularMarketVolume : null,
  };
}

// Günlük aralıkla küçük bir istek: yalnız güncel fiyat ve önceki kapanış gerekiyor.
export async function getQuote(symbol: string, f: FetchLike = fetch): Promise<Quote> {
  return getQuoteRaw(toYahoo(symbol), symbol, f);
}

// Yahoo'nun kendi sembolüyle (örn. "^GSPC", "USDTRY=X"); sonuç `label` anahtarıyla döner.
export async function getQuoteRaw(yahooSymbol: string, label: string, f: FetchLike = fetch): Promise<Quote> {
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;
  return normalizeQuote(await getJson(path, f), label);
}
