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

export interface ChartContext { now?: number; marketOpen?: boolean }

const MAX_INTRADAY_AGE_MIN = 30; // seans açıkken 1G'de son mum en çok bu kadar eski olabilir
const MAX_AGE_DAYS = 10; // hafta sonu + resmî tatil payı

export function assessChart(d: ChartData, period: string, ctx: ChartContext = {}): Outcome {
  if (!d.candles || d.candles.length === 0) return fail(`${period}: mum verisi boş`);
  const broken = d.candles.some((c) => !(c.c > 0) || c.h < c.l);
  if (broken) return warn(`${period}: bozuk mum var (kapanış ≤ 0 ya da yüksek < düşük)`);
  if (d.price == null) return warn(`${period}: ${d.candles.length} mum var, güncel fiyat yok`);
  if (!(d.price > 0)) return warn(`${period}: fiyat geçersiz (${d.price})`);
  if (ctx.now != null) {
    const ageMs = ctx.now - d.candles[d.candles.length - 1].t * 1000;
    const ageMin = Math.round(ageMs / 60_000);
    const ageDays = Math.floor(ageMs / 86_400_000);
    if (ageDays > MAX_AGE_DAYS) return warn(`${period}: son mum ${ageDays} gün eski`);
    if (period.toLowerCase() === "1g" && ctx.marketOpen && ageMin > MAX_INTRADAY_AGE_MIN) {
      return warn(`${period}: seans açık ama son mum ${ageMin} dk eski`);
    }
  }
  return ok(`${period}: ${d.candles.length} mum`);
}

export function assessQuotes(quotes: QuoteItem[], failed: string[], expected: number): Outcome {
  const priced = quotes.filter((q) => q.price != null && q.price > 0).length;
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
