export interface Dividend {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface Split {
  numerator: number;
  denominator: number;
}

export const trDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

const trNum = (n: number) => String(n).replace(".", ",");
export const splitText = (s: Split): string => `${trNum(s.numerator)}:${trNum(s.denominator)}`;

// Bugünden geriye 12 ay: (bugün − 1 yıl, bugün]. today = "YYYY-MM-DD".
export function ttmTotal(list: Dividend[], today: string): number {
  const c = new Date(`${today}T00:00:00Z`);
  c.setUTCFullYear(c.getUTCFullYear() - 1);
  const cutoff = c.toISOString().slice(0, 10);
  return list.filter((x) => x.date > cutoff && x.date <= today).reduce((s, x) => s + x.amount, 0);
}

export function yearlyTotals(list: Dividend[], limit = 8): { year: number; total: number; count: number }[] {
  const m = new Map<number, { year: number; total: number; count: number }>();
  for (const x of list) {
    const year = Number(x.date.slice(0, 4));
    const e = m.get(year) ?? { year, total: 0, count: 0 };
    e.total += x.amount;
    e.count++;
    m.set(year, e);
  }
  return [...m.values()].sort((a, b) => b.year - a.year).slice(0, limit);
}
