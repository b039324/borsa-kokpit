// Finansal tablo özeti: Yahoo "fundamentals-timeseries" ucu (resmi olmayan). quoteSummary'deki eski tablo
// modülleri boş döndüğü için bu uç kullanılır. Önce crumb'sız denenir; 401/403 gelirse çerez + crumb alınır.
import { getCrumb, hasCrumb, type Crumb, type FetchLike } from "./fundamentals";
import { YahooError } from "./yahoo";

const HOSTS = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];
const UA = "Mozilla/5.0 (compatible; borsa-kokpit)";
const YEARS_BACK = 6; // yıllık 5 dönem için pay bırakır
const KEEP = { annual: 5, quarterly: 8 } as const;

const ITEMS = ["TotalRevenue", "GrossProfit", "OperatingIncome", "NetIncome"] as const;
const FREQS = ["annual", "quarterly"] as const;
const TYPES = FREQS.flatMap((fr) => ITEMS.map((it) => `${fr}${it}`));
const TYPE_RE = /^(annual|quarterly)(TotalRevenue|GrossProfit|OperatingIncome|NetIncome)$/;
const FIELD = { TotalRevenue: "revenue", GrossProfit: "grossProfit", OperatingIncome: "operatingIncome", NetIncome: "netIncome" } as const;

export interface FinancialPeriod {
  date: string; // dönem sonu, YYYY-MM-DD
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
}

export interface Financials {
  symbol: string;
  currency: string | null;
  annual: FinancialPeriod[]; // eskiden yeniye, en çok 5
  quarterly: FinancialPeriod[]; // eskiden yeniye, en çok 8
}

export function normalizeFinancials(raw: any, symbol: string): Financials {
  const err = raw?.timeseries?.error;
  if (err) throw new YahooError(err.code === "Not Found" ? "notfound" : "upstream", err.description ?? "Yahoo hatası");
  const results: any[] = Array.isArray(raw?.timeseries?.result) ? raw.timeseries.result : [];

  const maps = { annual: new Map<string, FinancialPeriod>(), quarterly: new Map<string, FinancialPeriod>() };
  let currency: string | null = null;

  for (const r of results) {
    const type = r?.meta?.type?.[0];
    const m = typeof type === "string" ? TYPE_RE.exec(type) : null;
    const entries = m ? r[type] : null;
    if (!m || !Array.isArray(entries)) continue;
    const freq = m[1] as "annual" | "quarterly";
    const field = FIELD[m[2] as keyof typeof FIELD];
    for (const e of entries) {
      const v = e?.reportedValue?.raw;
      if (typeof e?.asOfDate !== "string" || typeof v !== "number" || !Number.isFinite(v)) continue;
      if (currency === null && typeof e.currencyCode === "string") currency = e.currencyCode;
      let p = maps[freq].get(e.asOfDate);
      if (!p) {
        p = { date: e.asOfDate, revenue: null, grossProfit: null, operatingIncome: null, netIncome: null };
        maps[freq].set(e.asOfDate, p);
      }
      p[field] = v;
    }
  }

  const list = (freq: "annual" | "quarterly") =>
    [...maps[freq].values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-KEEP[freq]);
  return { symbol, currency, annual: list("annual"), quarterly: list("quarterly") };
}

async function tryFetch(path: string, crumb: Crumb | null, f: FetchLike): Promise<{ json: any } | "auth"> {
  const full = crumb ? `${path}&crumb=${encodeURIComponent(crumb.crumb)}` : path;
  const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
  if (crumb) headers.Cookie = crumb.cookie;
  let last = "bilinmeyen hata";
  for (const host of HOSTS) {
    try {
      const res = await f(host + full, { headers });
      if (res.status === 404) throw new YahooError("notfound", "Bulunamadı");
      if (res.status === 401 || res.status === 403) return "auth";
      if (!res.ok) {
        last = `Yahoo ${res.status}`;
        continue;
      }
      return { json: await res.json() };
    } catch (e) {
      if (e instanceof YahooError) throw e;
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new YahooError("upstream", last);
}

export async function getFinancials(symbol: string, f: FetchLike = fetch, now = Date.now()): Promise<Financials> {
  const yahooSymbol = `${symbol}.IS`;
  const period2 = Math.floor(now / 1000);
  const period1 = period2 - YEARS_BACK * 365 * 86400;
  const path =
    `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(yahooSymbol)}` +
    `?symbol=${encodeURIComponent(yahooSymbol)}&type=${TYPES.join(",")}&period1=${period1}&period2=${period2}&lang=tr-TR&region=TR`;

  let out = await tryFetch(path, null, f);
  if (out === "auth") {
    const cached = hasCrumb();
    out = await tryFetch(path, await getCrumb(f, false), f);
    // Önbellekteki crumb eskimiş olabilir: yalnız o durumda bir kez yenileyip dener.
    if (out === "auth" && cached) out = await tryFetch(path, await getCrumb(f, true), f);
  }
  if (out === "auth") throw new YahooError("upstream", "Yahoo yetkilendirme hatası");
  return normalizeFinancials(out.json, symbol);
}
