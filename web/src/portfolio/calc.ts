export interface Position {
  symbol: string;
  qty: number;
  cost: number; // hisse başına ortalama maliyet
}

export interface PriceInfo {
  price: number | null;
  prevClose: number | null;
}

export interface Row {
  symbol: string;
  qty: number;
  cost: number;
  price: number | null;
  value: number | null;
  costTotal: number;
  pl: number | null;
  plPct: number | null; // oran (0,2 = %20)
  dayPl: number | null;
  weight: number | null; // fiyatı bilinen pozisyonların toplam değerindeki pay
}

export interface Totals {
  value: number;
  cost: number;
  pl: number;
  plPct: number | null;
  dayPl: number;
  dayPct: number | null;
  priced: number; // fiyatı bilinen pozisyon sayısı
  total: number;
}

// Fiyatı olmayan pozisyon toplamlara girmez (yanlış toplam yerine eksik ama tutarlı toplam).
export function buildPortfolio(positions: Position[], quotes: Record<string, PriceInfo | undefined>): { rows: Row[]; totals: Totals } {
  let value = 0, cost = 0, dayPl = 0, prevValue = 0, priced = 0;

  const rows: Row[] = positions.map((p) => {
    const q = quotes[p.symbol];
    const price = q?.price ?? null;
    const costTotal = p.qty * p.cost;
    if (price === null) {
      return { symbol: p.symbol, qty: p.qty, cost: p.cost, price: null, value: null, costTotal, pl: null, plPct: null, dayPl: null, weight: null };
    }
    const v = p.qty * price;
    const prev = q?.prevClose ?? null;
    const day = prev ? p.qty * (price - prev) : null;
    value += v;
    cost += costTotal;
    priced++;
    if (day !== null) {
      dayPl += day;
      prevValue += p.qty * (prev as number);
    }
    return {
      symbol: p.symbol, qty: p.qty, cost: p.cost, price, value: v, costTotal,
      pl: v - costTotal, plPct: costTotal > 0 ? (v - costTotal) / costTotal : null, dayPl: day, weight: null,
    };
  });

  if (value > 0) for (const r of rows) if (r.value !== null) r.weight = r.value / value;

  return {
    rows,
    totals: {
      value, cost, pl: value - cost,
      plPct: cost > 0 ? (value - cost) / cost : null,
      dayPl, dayPct: prevValue > 0 ? dayPl / prevValue : null,
      priced, total: positions.length,
    },
  };
}

// Alım ekleme: aynı sembol varsa adetler toplanır, maliyet ağırlıklı ortalama olur.
export function mergeLot(positions: Position[], symbol: string, qty: number, cost: number): Position[] {
  const i = positions.findIndex((p) => p.symbol === symbol);
  if (i < 0) return [...positions, { symbol, qty, cost }];
  const old = positions[i];
  const total = old.qty + qty;
  const avg = (old.qty * old.cost + qty * cost) / total;
  return positions.map((p, j) => (j === i ? { symbol, qty: total, cost: avg } : p));
}
