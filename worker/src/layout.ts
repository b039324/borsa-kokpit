export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedItem extends Rect {
  id: string;
}

export interface Layout {
  version: 1;
  items: PlacedItem[];
  parked: Record<string, Rect>;
}

export const LAYOUT_KEY = "layout:v1";
export const MAX_BODY_BYTES = 50_000;

const ID_RE = /^[a-z0-9-]{1,64}$/;
const MAX_ITEMS = 100;
const MAX_PARKED = 200;
const MAX_POS = 10_000;
const MAX_SIZE = 1_000;

type Result = { ok: true; layout: Layout } | { ok: false; error: string };

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function parseRect(v: unknown): Rect | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (
    !isInt(r.x, 0, MAX_POS) ||
    !isInt(r.y, 0, MAX_POS) ||
    !isInt(r.w, 1, MAX_SIZE) ||
    !isInt(r.h, 1, MAX_SIZE)
  ) {
    return null;
  }
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

// Gelen veriyi doğrular ve yalnız bilinen alanlarla yeniden kurar.
export function validateLayout(input: unknown): Result {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Düzen bir nesne olmalı" };
  }
  const body = input as Record<string, unknown>;
  if (body.version !== 1) return { ok: false, error: "Desteklenmeyen düzen sürümü" };

  if (!Array.isArray(body.items)) return { ok: false, error: "items bir dizi olmalı" };
  if (body.items.length > MAX_ITEMS) return { ok: false, error: "Çok fazla modül" };

  const seen = new Set<string>();
  const items: PlacedItem[] = [];
  for (const raw of body.items) {
    const rect = parseRect(raw);
    const id = (raw as { id?: unknown } | null)?.id;
    if (!rect || typeof id !== "string" || !ID_RE.test(id)) {
      return { ok: false, error: "Geçersiz modül kaydı" };
    }
    if (seen.has(id)) return { ok: false, error: "Aynı modül iki kez yazılmış" };
    seen.add(id);
    items.push({ id, ...rect });
  }

  const parked: Record<string, Rect> = {};
  if (body.parked !== undefined) {
    if (typeof body.parked !== "object" || body.parked === null || Array.isArray(body.parked)) {
      return { ok: false, error: "parked bir nesne olmalı" };
    }
    const entries = Object.entries(body.parked as Record<string, unknown>);
    if (entries.length > MAX_PARKED) return { ok: false, error: "Çok fazla kayıt" };
    for (const [id, raw] of entries) {
      const rect = parseRect(raw);
      if (!ID_RE.test(id) || !rect) return { ok: false, error: "Geçersiz parked kaydı" };
      parked[id] = rect;
    }
  }

  return { ok: true, layout: { version: 1, items, parked } };
}
