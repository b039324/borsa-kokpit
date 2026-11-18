export const PORTFOLIO_KEY = "portfolio:v1";
export const MAX_POSITIONS = 100;
const MAX_QTY = 1e9;
const MAX_COST = 1e7;

const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;

export interface Position {
  symbol: string;
  qty: number; // adet (lot değil, hisse adedi)
  cost: number; // hisse başına ortalama maliyet (TL)
}

type Result = { ok: true; positions: Position[] } | { ok: false; error: string };

const inRange = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max;

// Gövde: { positions: [{ symbol, qty, cost }] }. Sıra korunur, fazladan alanlar atılır,
// aynı sembol iki kez gelirse reddedilir (birleştirme istemcide yapılır).
export function validatePortfolio(input: unknown): Result {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Geçersiz portföy" };
  }
  const list = (input as { positions?: unknown }).positions;
  if (!Array.isArray(list)) return { ok: false, error: "positions dizi olmalı" };
  if (list.length > MAX_POSITIONS) return { ok: false, error: `En fazla ${MAX_POSITIONS} pozisyon` };
  const seen = new Set<string>();
  const positions: Position[] = [];
  for (const p of list) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) return { ok: false, error: "Geçersiz pozisyon" };
    const { symbol, qty, cost } = p as Record<string, unknown>;
    if (typeof symbol !== "string" || !SYMBOL_RE.test(symbol)) return { ok: false, error: "Geçersiz sembol" };
    if (seen.has(symbol)) return { ok: false, error: "Aynı sembol iki kez var" };
    if (!inRange(qty, MAX_QTY)) return { ok: false, error: "Geçersiz adet" };
    if (!inRange(cost, MAX_COST)) return { ok: false, error: "Geçersiz maliyet" };
    seen.add(symbol);
    positions.push({ symbol, qty, cost });
  }
  return { ok: true, positions };
}
