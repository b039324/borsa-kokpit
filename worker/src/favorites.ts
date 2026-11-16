export const FAVORITES_KEY = "favorites:v1";
export const MAX_FAVORITES = 50;

const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;

type Result = { ok: true; symbols: string[] } | { ok: false; error: string };

// Gövde: { symbols: ["THYAO", ...] }. Sıra korunur, tekrarlar atılır, fazladan alanlar yok sayılır.
export function validateFavorites(input: unknown): Result {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Geçersiz favori listesi" };
  }
  const list = (input as { symbols?: unknown }).symbols;
  if (!Array.isArray(list)) return { ok: false, error: "symbols dizi olmalı" };
  if (list.length > MAX_FAVORITES) return { ok: false, error: `En fazla ${MAX_FAVORITES} favori` };
  const seen = new Set<string>();
  for (const s of list) {
    if (typeof s !== "string" || !SYMBOL_RE.test(s)) return { ok: false, error: "Geçersiz sembol" };
    seen.add(s);
  }
  return { ok: true, symbols: [...seen] };
}
