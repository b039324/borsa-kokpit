// Temettü ve bölünme geçmişi: Yahoo chart ucunun "events" alanı (crumb gerekmez).
import { YahooError, getJson, type FetchLike } from "./yahoo";

export interface DividendItem {
  date: string; // YYYY-MM-DD (borsa saatiyle)
  amount: number; // hisse başına, para biriminde
}

export interface SplitItem {
  date: string;
  numerator: number;
  denominator: number;
}

export interface Dividends {
  symbol: string;
  currency: string | null;
  dividends: DividendItem[]; // yeniden eskiye
  splits: SplitItem[]; // yeniden eskiye
}

const isoDay = (t: number, gmtoffset: number) => new Date((t + gmtoffset) * 1000).toISOString().slice(0, 10);
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function normalizeDividends(raw: any, symbol: string): Dividends {
  const err = raw?.chart?.error;
  if (err) throw new YahooError(err.code === "Not Found" ? "notfound" : "upstream", err.description ?? "Yahoo hatası");
  const r = raw?.chart?.result?.[0];
  if (!r) throw new YahooError("notfound", "Veri yok");
  const gmt: number = typeof r.meta?.gmtoffset === "number" ? r.meta.gmtoffset : 10800;
  const time = (key: string, e: any) => (typeof e?.date === "number" ? e.date : Number(key));

  const dividends: DividendItem[] = [];
  for (const [k, e] of Object.entries<any>(r.events?.dividends ?? {})) {
    const t = time(k, e);
    if (positive(e?.amount) && Number.isFinite(t)) dividends.push({ date: isoDay(t, gmt), amount: e.amount });
  }
  const splits: SplitItem[] = [];
  for (const [k, e] of Object.entries<any>(r.events?.splits ?? {})) {
    const t = time(k, e);
    if (positive(e?.numerator) && positive(e?.denominator) && Number.isFinite(t)) {
      splits.push({ date: isoDay(t, gmt), numerator: e.numerator, denominator: e.denominator });
    }
  }
  const newestFirst = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);
  return {
    symbol,
    currency: typeof r.meta?.currency === "string" ? r.meta.currency : null,
    dividends: dividends.sort(newestFirst),
    splits: splits.sort(newestFirst),
  };
}

export async function getDividends(symbol: string, f: FetchLike = fetch): Promise<Dividends> {
  const path = `/v8/finance/chart/${encodeURIComponent(`${symbol}.IS`)}?range=10y&interval=1mo&events=div%7Csplit`;
  return normalizeDividends(await getJson(path, f), symbol);
}
