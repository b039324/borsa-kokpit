import type { QuoteItem } from "../api";

export interface Row {
  symbol: string;
  price: number;
  pct: number | null; // günlük değişim, yüzde (örn. 2,5)
  tl: number; // gün içi TL hacim (fiyat × lot); lot yoksa 0
}

// Fiyatı gelen hisseleri satıra çevirir. Kotasyonu ya da fiyatı olmayan atılır.
export function rankRows(symbols: string[], quotes: Record<string, QuoteItem>): Row[] {
  const rows: Row[] = [];
  for (const symbol of symbols) {
    const q = quotes[symbol];
    const price = q?.price;
    if (price === null || price === undefined) continue;
    const prev = q.prevClose;
    rows.push({
      symbol,
      price,
      pct: prev ? ((price - prev) * 100) / prev : null,
      tl: price * (q.volume ?? 0),
    });
  }
  return rows;
}

const bySymbol = (a: Row, b: Row) => a.symbol.localeCompare(b.symbol);

type WithPct = Row & { pct: number };
const withPct = (rows: Row[]): WithPct[] => rows.filter((r): r is WithPct => r.pct !== null);

export function topGainers(rows: Row[], n: number): Row[] {
  return withPct(rows)
    .sort((a, b) => b.pct - a.pct || bySymbol(a, b))
    .slice(0, n);
}

export function topLosers(rows: Row[], n: number): Row[] {
  return withPct(rows)
    .sort((a, b) => a.pct - b.pct || bySymbol(a, b))
    .slice(0, n);
}

export function topVolume(rows: Row[], n: number): Row[] {
  return rows
    .filter((r) => r.tl > 0)
    .sort((a, b) => b.tl - a.tl || bySymbol(a, b))
    .slice(0, n);
}

export interface Breadth {
  up: number;
  down: number;
  flat: number;
  total: number;
  upRatio: number | null;
}

// Piyasa genişliği: yükselen / düşen / değişmeyen sayısı (günlük değişimi hesaplanabilenler).
export function breadth(rows: Row[]): Breadth {
  let up = 0;
  let down = 0;
  let flat = 0;
  for (const r of withPct(rows)) {
    if (r.pct > 0) up++;
    else if (r.pct < 0) down++;
    else flat++;
  }
  const total = up + down + flat;
  return { up, down, flat, total, upRatio: total ? up / total : null };
}

// BIST'te günlük fiyat limiti ±%10; eşiğe gelenler tavana/tabana yakın sayılır.
export function nearLimit(rows: Row[], threshold = 9): { up: Row[]; down: Row[] } {
  const all = withPct(rows);
  return {
    up: all.filter((r) => r.pct >= threshold).sort((a, b) => b.pct - a.pct || bySymbol(a, b)),
    down: all.filter((r) => r.pct <= -threshold).sort((a, b) => a.pct - b.pct || bySymbol(a, b)),
  };
}
