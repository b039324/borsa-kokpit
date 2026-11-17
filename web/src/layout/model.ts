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

// Tek bir sayfanın (sekmenin) içeriği.
export interface Page {
  items: PlacedItem[];
  parked: Record<string, Rect>;
}

export interface Tab extends Page {
  id: string;
  name: string;
}

export interface Layout {
  version: 2;
  active: string;
  tabs: Tab[];
}

export const MAX_TABS = 8;
export const MAX_TAB_NAME = 24;

// Yeni modüllerin yerleştirileceği asgari sütun sayısı (96 x 20px = 1920px).
export const MIN_COLS = 96;

const ID_RE = /^[a-z0-9-]{1,64}$/;
const MAX_ITEMS = 100;
const MAX_POS = 10_000;
const MAX_SIZE = 1_000;

export function emptyPage(): Page {
  return { items: [], parked: {} };
}

export function emptyLayout(): Layout {
  return { version: 2, active: "sayfa-1", tabs: [{ id: "sayfa-1", name: "Sayfa 1", ...emptyPage() }] };
}

export function isActive(page: Page, id: string): boolean {
  return page.items.some((i) => i.id === id);
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

export function activate<P extends Page>(
  layout: P,
  id: string,
  size: { w: number; h: number },
  cols: number = MIN_COLS,
): P {
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
    ...layout,
    items: [...layout.items, { id, ...pos, w, h }],
    parked: rest,
  };
}

export function deactivate<P extends Page>(layout: P, id: string): P {
  const item = layout.items.find((i) => i.id === id);
  if (!item) return layout;
  return {
    ...layout,
    items: layout.items.filter((i) => i.id !== id),
    parked: { ...layout.parked, [id]: pick(item) },
  };
}

// Sürükleme/boyutlandırma bitince yalnız ilgili modülün dikdörtgeni güncellenir.
export function updateRect<P extends Page>(layout: P, id: string, rect: Rect): P {
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
    ...layout,
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

function sanitizePage(body: Record<string, unknown>): Page {
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
  return { items, parked };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Sunucudan ya da eski sürümden gelen veriyi güvenle düzene çevirir; bozuk kayıtları atar.
// Sürüm 1 (tek sayfa) tek sekmeli "Sayfa 1"e taşınır, hiçbir şey kaybolmaz.
export function sanitizeLayout(input: unknown): Layout {
  if (!isObject(input)) return emptyLayout();

  if (input.version === 1) {
    const base = emptyLayout();
    return { ...base, tabs: [{ ...base.tabs[0], ...sanitizePage(input) }] };
  }
  if (input.version !== 2 || !Array.isArray(input.tabs)) return emptyLayout();

  const tabs: Tab[] = [];
  const seen = new Set<string>();
  for (const raw of input.tabs) {
    if (tabs.length >= MAX_TABS) break;
    if (!isObject(raw)) continue;
    const id = raw.id;
    if (typeof id !== "string" || !ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    const trimmed = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_TAB_NAME) : "";
    tabs.push({ id, name: trimmed || id, ...sanitizePage(raw) });
  }
  if (tabs.length === 0) return emptyLayout();

  const active = typeof input.active === "string" && seen.has(input.active) ? input.active : tabs[0].id;
  return { version: 2, active, tabs };
}

// ---- Sekmeler ----

export function activePage(layout: Layout): Tab {
  return layout.tabs.find((t) => t.id === layout.active) ?? layout.tabs[0];
}

// Etkin sekmenin içeriğini değiştirir; fn aynı nesneyi döndürürse düzen de aynen döner.
export function updateActivePage(layout: Layout, fn: (page: Tab) => Tab): Layout {
  const current = activePage(layout);
  const next = fn(current);
  if (next === current) return layout;
  return { ...layout, tabs: layout.tabs.map((t) => (t === current ? next : t)) };
}

export function selectTab(layout: Layout, id: string): Layout {
  if (id === layout.active || !layout.tabs.some((t) => t.id === id)) return layout;
  return { ...layout, active: id };
}

// Yeni boş sayfa; adı ve kimliği kullanılmayan en küçük numaradan türer. Etkin sayfa olur.
export function addTab(layout: Layout): Layout {
  if (layout.tabs.length >= MAX_TABS) return layout;
  const usedIds = new Set(layout.tabs.map((t) => t.id));
  const usedNames = new Set(layout.tabs.map((t) => t.name));
  let n = 1;
  while (usedIds.has(`sayfa-${n}`) || usedNames.has(`Sayfa ${n}`)) n++;
  const tab: Tab = { id: `sayfa-${n}`, name: `Sayfa ${n}`, ...emptyPage() };
  return { ...layout, active: tab.id, tabs: [...layout.tabs, tab] };
}

export function removeTab(layout: Layout, id: string): Layout {
  const index = layout.tabs.findIndex((t) => t.id === id);
  if (index < 0 || layout.tabs.length <= 1) return layout;
  const tabs = layout.tabs.filter((t) => t.id !== id);
  let active = layout.active;
  if (active === id) active = (tabs[index] ?? tabs[index - 1]).id;
  return { ...layout, active, tabs };
}

export function renameTab(layout: Layout, id: string, name: string): Layout {
  const next = name.trim();
  const tab = layout.tabs.find((t) => t.id === id);
  if (!tab || next.length < 1 || next.length > MAX_TAB_NAME || next === tab.name) return layout;
  return { ...layout, tabs: layout.tabs.map((t) => (t === tab ? { ...t, name: next } : t)) };
}

// `id` sekmesini `overId` sekmesinin bulunduğu yere taşır (sürükle-bırak).
export function moveTab(layout: Layout, id: string, overId: string): Layout {
  const from = layout.tabs.findIndex((t) => t.id === id);
  const to = layout.tabs.findIndex((t) => t.id === overId);
  if (from < 0 || to < 0 || from === to) return layout;
  const tabs = [...layout.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved);
  return { ...layout, tabs };
}
