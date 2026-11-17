export const nf = (n: number, d = 2) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });

// 1.234.567 → "1,23 mn", 1,2 milyar → "1,20 mr"
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${nf(n / 1e9)} mr`;
  if (a >= 1e6) return `${nf(n / 1e6)} mn`;
  return nf(n, 0);
}

const two = (n: number) => String(n).padStart(2, "0");

export function fmtTime(t: number, off: number, period: string): string {
  const d = new Date((t + off) * 1000);
  const hm = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  const dm = `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}`;
  if (period === "1g") return hm;
  if (period === "1h" || period === "1a") return `${dm} ${hm}`;
  if (period === "5y") return `${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  return `${dm}.${String(d.getUTCFullYear()).slice(2)}`;
}


// 0,2834 → "28,34%"; signed=true → artışta "+" ekler
export function pct(ratio: number, signed = false): string {
  const v = ratio * 100;
  return `${signed && v > 0 ? "+" : ""}${nf(v)}%`;
}

// Unix saniye + borsa saat dilimi farkı (sn) → "14.11.26"
export function fmtDay(t: number, gmtoffset: number): string {
  const d = new Date((t + gmtoffset) * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${String(d.getUTCFullYear()).slice(2)}`;
}
