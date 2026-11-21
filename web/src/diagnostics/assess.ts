import type { ChartData, DividendsData, Financials, Fundamentals, MarketItem, QuoteItem, StatsItem } from "../api";
import type { Outcome } from "./types";

const ok = (detail: string): Outcome => ({ status: "ok", detail });
const warn = (detail: string): Outcome => ({ status: "warn", detail });
const fail = (detail: string): Outcome => ({ status: "fail", detail });

export function assessMarket(items: MarketItem[]): Outcome {
  if (items.length === 0) return fail("Hiç piyasa kalemi gelmedi");
  const filled = items.filter((i) => i.price != null).length;
  return filled < items.length ? warn(`${filled}/${items.length} fiyat geldi`) : ok(`${filled}/${items.length} fiyat`);
}

export function assessChart(d: ChartData, period: string): Outcome {
  if (!d.candles || d.candles.length === 0) return fail(`${period}: mum verisi boş`);
  if (d.price == null) return warn(`${period}: ${d.candles.length} mum var, güncel fiyat yok`);
  return ok(`${period}: ${d.candles.length} mum`);
}

export function assessQuotes(quotes: QuoteItem[], failed: string[], expected: number): Outcome {
  const priced = quotes.filter((q) => q.price != null).length;
  if (priced === 0) return fail("Hiç fiyat gelmedi");
  if (priced < expected) {
    return warn(`${priced}/${expected} fiyat geldi${failed.length ? `; eksik: ${failed.join(", ")}` : ""}`);
  }
  return ok(`${priced}/${expected} fiyat`);
}

export function assessStats(stats: StatsItem[], failed: string[], expected: number): Outcome {
  if (stats.length === 0) return fail("Hiç istatistik gelmedi");
  const noRsi = stats.filter((s) => s.rsi == null).length;
  if (noRsi === stats.length) return warn("RSI hiç gelmedi (Worker güncel değil olabilir)");
  const short = stats.length < expected ? `; eksik: ${failed.join(", ") || expected - stats.length + " hisse"}` : "";
  if (short || noRsi > 0) return warn(`${stats.length}/${expected} hisse, ${noRsi} tanesinde RSI yok${short}`);
  return ok(`${stats.length}/${expected} hisse`);
}

const FUND_KEYS: (keyof Fundamentals)[] = [
  "marketCap", "trailingPE", "priceToBook", "beta", "trailingEps", "bookValue", "dividendYield", "returnOnEquity",
];

export function assessFundamentals(f: Fundamentals): Outcome {
  const filled = FUND_KEYS.filter((k) => f[k] != null).length;
  if (filled === 0) return fail("Hiçbir temel veri alanı dolu değil");
  if (filled < 5) return warn(`${filled}/${FUND_KEYS.length} alan dolu`);
  return ok(`${filled}/${FUND_KEYS.length} alan dolu`);
}

export function assessFinancials(f: Financials, isBank: boolean): Outcome {
  if (!f.annual || f.annual.length === 0) return fail("Yıllık dönem gelmedi");
  const noRevenue = f.annual.every((p) => p.revenue == null);
  if (noRevenue) return warn(isBank ? "Gelir kalemi yok (banka: Yahoo bankalarda gelir vermeyebilir)" : "Gelir kalemi yok");
  return ok(`${f.annual.length} yıllık, ${f.quarterly?.length ?? 0} çeyreklik dönem`);
}

export function assessDividends(d: DividendsData): Outcome {
  if (!d.dividends || d.dividends.length === 0) return warn("Temettü kaydı yok");
  return ok(`${d.dividends.length} temettü, ${d.splits?.length ?? 0} bölünme`);
}

export function assessList(v: unknown[], noun: string): Outcome {
  if (!Array.isArray(v)) return fail("Liste yerine başka bir şey döndü");
  return ok(`${v.length} ${noun}`);
}
