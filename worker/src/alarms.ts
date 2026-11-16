export const ALARMS_KEY = "alarms:v1";
export const MAX_ALARMS = 30;

const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export interface Alarm {
  id: string;
  symbol: string;
  dir: "above" | "below"; // above: fiyat hedefe çıkınca / below: hedefe inince
  price: number;
  createdAt: number; // ms
  triggeredAt: number | null; // ms; null = hâlâ aktif
}

type Result = { ok: true; alarms: Alarm[] } | { ok: false; error: string };

const isMs = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

// Gövde: { alarms: [{ id, symbol, dir, price, createdAt, triggeredAt? }] }. Fazladan alanlar atılır.
export function validateAlarms(input: unknown): Result {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Geçersiz alarm listesi" };
  }
  const list = (input as { alarms?: unknown }).alarms;
  if (!Array.isArray(list)) return { ok: false, error: "alarms dizi olmalı" };
  if (list.length > MAX_ALARMS) return { ok: false, error: `En fazla ${MAX_ALARMS} alarm` };
  const ids = new Set<string>();
  const out: Alarm[] = [];
  for (const x of list) {
    if (typeof x !== "object" || x === null) return { ok: false, error: "Geçersiz alarm" };
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || !ID_RE.test(o.id)) return { ok: false, error: "Geçersiz alarm kimliği" };
    if (ids.has(o.id)) return { ok: false, error: "Tekrar eden alarm kimliği" };
    ids.add(o.id);
    if (typeof o.symbol !== "string" || !SYMBOL_RE.test(o.symbol)) return { ok: false, error: "Geçersiz sembol" };
    if (o.dir !== "above" && o.dir !== "below") return { ok: false, error: "Geçersiz yön" };
    if (typeof o.price !== "number" || !Number.isFinite(o.price) || o.price <= 0) return { ok: false, error: "Geçersiz fiyat" };
    if (!isMs(o.createdAt)) return { ok: false, error: "Geçersiz oluşturma zamanı" };
    if (o.triggeredAt !== undefined && o.triggeredAt !== null && !isMs(o.triggeredAt)) {
      return { ok: false, error: "Geçersiz tetiklenme zamanı" };
    }
    out.push({
      id: o.id,
      symbol: o.symbol,
      dir: o.dir,
      price: o.price,
      createdAt: o.createdAt,
      triggeredAt: (o.triggeredAt as number | null | undefined) ?? null,
    });
  }
  return { ok: true, alarms: out };
}
