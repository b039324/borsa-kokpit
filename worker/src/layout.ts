export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedItem extends Rect {
  id: string;
}

export interface LayoutV1 {
  version: 1;
  items: PlacedItem[];
  parked: Record<string, Rect>;
}

export interface Tab {
  id: string;
  name: string;
  items: PlacedItem[];
  parked: Record<string, Rect>;
}

export interface Layout {
  version: 2;
  active: string;
  tabs: Tab[];
}

export const LAYOUT_KEY = "layout:v1";
export const MAX_BODY_BYTES = 100_000;
export const MAX_TABS = 8;
export const MAX_TAB_NAME = 24;

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

type Fail = { ok: false; error: string };

// Tek sayfanın modül ve park kayıtlarını doğrular.
function parsePage(
  body: Record<string, unknown>,
): { ok: true; items: PlacedItem[]; parked: Record<string, Rect> } | Fail {
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
  return { ok: true, items, parked };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Gelen veriyi doğrular ve yalnız bilinen alanlarla yeniden kurar.
// Sürüm 1 (tek sayfa) otomatik olarak tek sekmeli sürüm 2'ye taşınır.
export function validateLayout(input: unknown): Result {
  if (!isObject(input)) return { ok: false, error: "Düzen bir nesne olmalı" };

  if (input.version === 1) {
    const page = parsePage(input);
    if (!page.ok) return page;
    return {
      ok: true,
      layout: {
        version: 2,
        active: "sayfa-1",
        tabs: [{ id: "sayfa-1", name: "Sayfa 1", items: page.items, parked: page.parked }],
      },
    };
  }
  if (input.version !== 2) return { ok: false, error: "Desteklenmeyen düzen sürümü" };

  if (!Array.isArray(input.tabs)) return { ok: false, error: "tabs bir dizi olmalı" };
  if (input.tabs.length < 1 || input.tabs.length > MAX_TABS) {
    return { ok: false, error: "Sekme sayısı 1 ile 8 arasında olmalı" };
  }

  const ids = new Set<string>();
  const tabs: Tab[] = [];
  for (const raw of input.tabs) {
    if (!isObject(raw)) return { ok: false, error: "Geçersiz sekme kaydı" };
    const id = raw.id;
    if (typeof id !== "string" || !ID_RE.test(id)) return { ok: false, error: "Geçersiz sekme kimliği" };
    if (ids.has(id)) return { ok: false, error: "Aynı sekme iki kez yazılmış" };
    ids.add(id);
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name.length < 1 || name.length > MAX_TAB_NAME) return { ok: false, error: "Geçersiz sekme adı" };
    const page = parsePage(raw);
    if (!page.ok) return page;
    tabs.push({ id, name, items: page.items, parked: page.parked });
  }

  const active = typeof input.active === "string" && ids.has(input.active) ? input.active : tabs[0].id;
  return { ok: true, layout: { version: 2, active, tabs } };
}
