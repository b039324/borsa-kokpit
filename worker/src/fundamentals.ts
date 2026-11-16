// Temel analiz verisi: Yahoo quoteSummary (resmi olmayan). Bu uç nokta çerez + "crumb" ister;
// crumb bir kez alınıp bellekte saklanır, 401/403 gelirse bir kez yenilenir.
import { YahooError } from "./yahoo";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const UA = "Mozilla/5.0 (compatible; borsa-kokpit)";
const MODULES = ["price", "summaryDetail", "defaultKeyStatistics", "financialData"];
const CRUMB_TTL_MS = 6 * 3600_000;

interface Crumb {
  crumb: string;
  cookie: string;
  exp: number;
}
let crumbCache: Crumb | null = null;

export function resetCrumbCache(): void {
  crumbCache = null;
}

async function getCrumb(f: FetchLike, force: boolean): Promise<Crumb> {
  if (!force && crumbCache && crumbCache.exp > Date.now()) return crumbCache;
  let cookie = "";
  try {
    const r = await f("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" });
    const sc = r.headers.get("set-cookie") ?? "";
    cookie = sc.match(/\b(A3=[^;]+)/)?.[1] ?? sc.split(";")[0] ?? "";
  } catch (e) {
    throw new YahooError("upstream", e instanceof Error ? e.message : "Çerez alınamadı");
  }
  if (!cookie) throw new YahooError("upstream", "Yahoo çerezi alınamadı");
  let text = "";
  try {
    const r = await f(`${HOSTS[0]}/v1/test/getcrumb`, { headers: { "User-Agent": UA, Cookie: cookie } });
    if (!r.ok) throw new YahooError("upstream", `Yahoo crumb ${r.status}`);
    text = (await r.text()).trim();
  } catch (e) {
    if (e instanceof YahooError) throw e;
    throw new YahooError("upstream", e instanceof Error ? e.message : "Crumb alınamadı");
  }
  if (!text || text.length > 64 || /[<\s]/.test(text)) throw new YahooError("upstream", "Geçersiz crumb");
  crumbCache = { crumb: text, cookie, exp: Date.now() + CRUMB_TTL_MS };
  return crumbCache;
}

export interface Fundamentals {
  symbol: string;
  name: string | null;
  currency: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  enterpriseToEbitda: number | null;
  trailingEps: number | null;
  bookValue: number | null;
  dividendYield: number | null; // oran (0.021 = %2,1)
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  returnOnEquity: number | null; // oran
  returnOnAssets: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null; // Yahoo yüzde olarak verir (95,5 = %95,5)
  currentRatio: number | null;
}

// Yahoo değerleri {raw, fmt} ya da düz sayı olabilir.
function num(x: any): number | null {
  const v = x && typeof x === "object" ? x.raw : x;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function normalizeFundamentals(raw: any, symbol: string): Fundamentals {
  const res = raw?.quoteSummary?.result?.[0];
  if (!res) throw new YahooError("notfound", "Bulunamadı");
  const p = res.price ?? {};
  const s = res.summaryDetail ?? {};
  const k = res.defaultKeyStatistics ?? {};
  const fd = res.financialData ?? {};
  const str = (x: any) => (typeof x === "string" && x ? x : null);
  return {
    symbol,
    name: str(p.longName) ?? str(p.shortName),
    currency: str(p.currency),
    marketCap: num(p.marketCap) ?? num(s.marketCap),
    trailingPE: num(s.trailingPE) ?? num(k.trailingPE),
    forwardPE: num(s.forwardPE) ?? num(k.forwardPE),
    priceToBook: num(k.priceToBook),
    priceToSales: num(s.priceToSalesTrailing12Months),
    enterpriseToEbitda: num(k.enterpriseToEbitda),
    trailingEps: num(k.trailingEps),
    bookValue: num(k.bookValue),
    dividendYield: num(s.dividendYield),
    beta: num(s.beta) ?? num(k.beta),
    fiftyTwoWeekHigh: num(s.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(s.fiftyTwoWeekLow),
    fiftyDayAverage: num(s.fiftyDayAverage),
    twoHundredDayAverage: num(s.twoHundredDayAverage),
    returnOnEquity: num(fd.returnOnEquity),
    returnOnAssets: num(fd.returnOnAssets),
    grossMargins: num(fd.grossMargins),
    operatingMargins: num(fd.operatingMargins),
    profitMargins: num(fd.profitMargins) ?? num(k.profitMargins),
    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth),
    debtToEquity: num(fd.debtToEquity),
    currentRatio: num(fd.currentRatio),
  };
}

// "ok" → json, "auth" → crumb yenilenmeli
async function trySummary(symbol: string, c: Crumb, f: FetchLike): Promise<{ json: any } | "auth"> {
  const path = `/v10/finance/quoteSummary/${encodeURIComponent(symbol + ".IS")}?modules=${MODULES.join(",")}&crumb=${encodeURIComponent(c.crumb)}`;
  let last = "bilinmeyen hata";
  for (const host of HOSTS) {
    try {
      const res = await f(host + path, { headers: { "User-Agent": UA, Accept: "application/json", Cookie: c.cookie } });
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

export async function getFundamentals(symbol: string, f: FetchLike = fetch): Promise<Fundamentals> {
  let out = await trySummary(symbol, await getCrumb(f, false), f);
  if (out === "auth") out = await trySummary(symbol, await getCrumb(f, true), f);
  if (out === "auth") throw new YahooError("upstream", "Yahoo yetkilendirme hatası");
  return normalizeFundamentals(out.json, symbol);
}
