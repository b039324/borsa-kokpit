// Düzen modeli: yalnız saf fonksiyonlar. Birimler ızgara hücresidir (1 hücre = GRID_SIZE px).
// Modül kaydedilince konum/boyut korunur; kapatılan modülün yeri "parked" içinde saklanır,
// tekrar açılınca aynı yere döner.

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

// Yeni modüllerin yerleştirileceği asgari sütun sayısı (96 x 20px = 1920px).
export const MIN_COLS = 96;

const ID_RE = /^[a-z0-9-]{1,64}$/;
const MAX_ITEMS = 100;
const MAX_POS = 10_000;
const MAX_SIZE = 1_000;

export function emptyLayout(): Layout {
  return { version: 1, items: [], parked: {} };
}

export function isActive(layout: Layout, id: string): boolean {
  return layout.items.some((i) => i.id === id);
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function validRect(r: Rect): boolean {
  return (
    Number.isInteger(r.x) &&
    Number.isInteger(r.y) &&
    Number.isInteger(r.w) &&
    Number.isInteger(r.h) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w >= 1 &&
    r.h >= 1 &&
    r.x <= MAX_POS &&
    r.y <= MAX_POS &&
    r.w <= MAX_SIZE &&
    r.h <= MAX_SIZE
  );
}

function pick(r: Rect): Rect {
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

// Soldan sağa, yukarıdan aşağıya ilk boş yeri bulur.
export function findFreeSpot(
  items: Rect[],
  w: number,
  h: number,
  cols: number = MIN_COLS,
): { x: number; y: number } {
  const bottom = items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
  const maxX = Math.max(0, cols - w);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x <= maxX; x++) {
      const probe = { x, y, w, h };
      if (!items.some((i) => overlaps(probe, i))) return { x, y };
    }
  }
  return { x: 0, y: bottom };
}

export function activate(
  layout: Layout,
  id: string,
  size: { w: number; h: number },
  cols: number = MIN_COLS,
): Layout {
  if (isActive(layout, id)) return layout;

  const parked = layout.parked[id];
  const w = parked ? parked.w : size.w;
  const h = parked ? parked.h : size.h;

  let pos: { x: number; y: number };
  if (parked && !layout.items.some((i) => overlaps(parked, i))) {
    pos = { x: parked.x, y: parked.y };
  } else {
    pos = findFreeSpot(layout.items, w, h, cols);
  }

  const rest = { ...layout.parked };
  delete rest[id];
  return {
    version: 1,
    items: [...layout.items, { id, ...pos, w, h }],
    parked: rest,
  };
}

export function deactivate(layout: Layout, id: string): Layout {
  const item = layout.items.find((i) => i.id === id);
  if (!item) return layout;
  return {
    version: 1,
    items: layout.items.filter((i) => i.id !== id),
    parked: { ...layout.parked, [id]: pick(item) },
  };
}

// Sürükleme/boyutlandırma bitince yalnız ilgili modülün dikdörtgeni güncellenir.
export function updateRect(layout: Layout, id: string, rect: Rect): Layout {
  const current = layout.items.find((i) => i.id === id);
  if (!current || !validRect(rect)) return layout;
  if (
    current.x === rect.x &&
    current.y === rect.y &&
    current.w === rect.w &&
    current.h === rect.h
  ) {
    return layout;
  }
  return {
    version: 1,
    items: layout.items.map((i) => (i.id === id ? { id, ...pick(rect) } : i)),
    parked: layout.parked,
  };
}

function toRect(v: unknown): Rect | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const rect = { x: r.x, y: r.y, w: r.w, h: r.h } as Rect;
  return validRect(rect) ? pick(rect) : null;
}

// Sunucudan ya da eski sürümden gelen veriyi güvenle düzene çevirir; bozuk kayıtları atar.
export function sanitizeLayout(input: unknown): Layout {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return emptyLayout();
  const body = input as Record<string, unknown>;
  if (body.version !== 1) return emptyLayout();

  const items: PlacedItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(body.items)) {
    for (const raw of body.items.slice(0, MAX_ITEMS)) {
      const rect = toRect(raw);
      const id = (raw as { id?: unknown } | null)?.id;
      if (!rect || typeof id !== "string" || !ID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      items.push({ id, ...rect });
    }
  }

  const parked: Record<string, Rect> = {};
  if (typeof body.parked === "object" && body.parked !== null && !Array.isArray(body.parked)) {
    for (const [id, raw] of Object.entries(body.parked as Record<string, unknown>)) {
      const rect = toRect(raw);
      if (rect && ID_RE.test(id)) parked[id] = rect;
    }
  }

  return { version: 1, items, parked };
}
