export interface Period {
  date: string; // dönem sonu, YYYY-MM-DD
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
}

export type Mode = "annual" | "quarterly";

export interface Column extends Period {
  label: string;
  netMargin: number | null; // net kâr ÷ gelir (oran)
  revenueYoy: number | null; // geçen yılın aynı dönemine göre değişim (oran)
  netIncomeYoy: number | null;
}

// Önceki değer negatifse payda mutlak değerdir: zarardan kâra geçiş pozitif büyüme sayılır.
export function growth(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

export function periodLabel(date: string, mode: Mode): string {
  const year = date.slice(0, 4);
  if (mode === "annual") return year;
  const month = Number(date.slice(5, 7));
  return `${year} Ç${Math.ceil(month / 3)}`;
}

// Büyüme hep geçen yılın aynı dönemine göredir (çeyrekte mevsimselliği bozmamak için).
export function buildColumns(periods: Period[], mode: Mode): Column[] {
  return periods.map((p) => {
    const prefix = `${Number(p.date.slice(0, 4)) - 1}-${p.date.slice(5, 7)}`;
    const base = periods.find((q) => q.date.startsWith(prefix)) ?? null;
    return {
      ...p,
      label: periodLabel(p.date, mode),
      netMargin: p.netIncome !== null && p.revenue ? p.netIncome / p.revenue : null,
      revenueYoy: growth(p.revenue, base?.revenue ?? null),
      netIncomeYoy: growth(p.netIncome, base?.netIncome ?? null),
    };
  });
}
