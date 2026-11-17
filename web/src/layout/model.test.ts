import { describe, it, expect } from "vitest";
import {
  MIN_COLS,
  activate,
  deactivate,
  emptyLayout,
  emptyPage,
  findFreeSpot,
  isActive,
  overlaps,
  sanitizeLayout,
  updateRect,
  type Page,
} from "./model";

const size = { w: 20, h: 10 };

function layoutOf(items: Page["items"], parked: Page["parked"] = {}): Page {
  return { items, parked };
}

describe("overlaps", () => {
  it("çakışan ve kenarı değen dikdörtgenleri ayırt eder", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });
});

describe("findFreeSpot", () => {
  it("boş alanda sol üst köşeyi verir", () => {
    expect(findFreeSpot([], 20, 10)).toEqual({ x: 0, y: 0 });
  });

  it("dolu yerin yanına yerleştirir", () => {
    expect(findFreeSpot([{ x: 0, y: 0, w: 20, h: 10 }], 20, 10)).toEqual({ x: 20, y: 0 });
  });

  it("satır dolunca alt satıra geçer", () => {
    const row = [{ x: 0, y: 0, w: MIN_COLS, h: 10 }];
    expect(findFreeSpot(row, 20, 10)).toEqual({ x: 0, y: 10 });
  });

  it("sütun sayısını aşmaz", () => {
    const items = [{ x: 0, y: 0, w: MIN_COLS - 10, h: 10 }];
    const spot = findFreeSpot(items, 20, 10);
    expect(spot.x + 20).toBeLessThanOrEqual(MIN_COLS);
    expect(spot).toEqual({ x: 0, y: 10 });
  });

  it("sütundan geniş öğe için de sonlanır", () => {
    const spot = findFreeSpot([{ x: 0, y: 0, w: 10, h: 10 }], MIN_COLS + 50, 5);
    expect(spot).toEqual({ x: 0, y: 10 });
  });

  it("aradaki boşluğu kullanır", () => {
    const items = [
      { x: 0, y: 0, w: 20, h: 10 },
      { x: 40, y: 0, w: 20, h: 10 },
    ];
    expect(findFreeSpot(items, 20, 10)).toEqual({ x: 20, y: 0 });
  });
});

describe("activate", () => {
  it("modülü varsayılan boyutla boş yere ekler", () => {
    const l = activate(emptyPage(), "grafik", size);
    expect(l.items).toEqual([{ id: "grafik", x: 0, y: 0, w: 20, h: 10 }]);
    expect(isActive(l, "grafik")).toBe(true);
  });

  it("ikinci modül ilkinin üstüne binmez", () => {
    let l = activate(emptyPage(), "a", size);
    l = activate(l, "b", size);
    expect(l.items[1]).toEqual({ id: "b", x: 20, y: 0, w: 20, h: 10 });
  });

  it("zaten aktifse aynı düzeni döndürür", () => {
    const l = activate(emptyPage(), "a", size);
    expect(activate(l, "a", size)).toBe(l);
  });

  it("girdiyi değiştirmez", () => {
    const l = emptyPage();
    activate(l, "a", size);
    expect(l.items).toHaveLength(0);
  });

  it("park edilmiş konuma geri döner ve parked'dan silinir", () => {
    const l = layoutOf([], { a: { x: 7, y: 3, w: 25, h: 12 } });
    const out = activate(l, "a", size);
    expect(out.items).toEqual([{ id: "a", x: 7, y: 3, w: 25, h: 12 }]);
    expect(out.parked).toEqual({});
  });

  it("park edilmiş konum doluysa boş yer bulur ama park boyutunu korur", () => {
    const l = layoutOf([{ id: "b", x: 0, y: 0, w: 30, h: 30 }], {
      a: { x: 5, y: 5, w: 25, h: 12 },
    });
    const out = activate(l, "a", size);
    const a = out.items.find((i) => i.id === "a")!;
    expect(overlaps(a, out.items.find((i) => i.id === "b")!)).toBe(false);
    expect(a.w).toBe(25);
    expect(a.h).toBe(12);
    expect(out.parked).toEqual({});
  });
});

describe("deactivate", () => {
  it("modülü kaldırır ve konumunu parked'a yazar", () => {
    const l = layoutOf([{ id: "a", x: 4, y: 2, w: 20, h: 10 }]);
    const out = deactivate(l, "a");
    expect(out.items).toEqual([]);
    expect(out.parked).toEqual({ a: { x: 4, y: 2, w: 20, h: 10 } });
  });

  it("aktif değilse aynı düzeni döndürür", () => {
    const l = emptyPage();
    expect(deactivate(l, "yok")).toBe(l);
  });

  it("diğer modüllere dokunmaz", () => {
    const l = layoutOf([
      { id: "a", x: 0, y: 0, w: 20, h: 10 },
      { id: "b", x: 20, y: 0, w: 20, h: 10 },
    ]);
    expect(deactivate(l, "a").items).toEqual([{ id: "b", x: 20, y: 0, w: 20, h: 10 }]);
  });

  it("kapat/aç döngüsü konumu ve boyutu korur", () => {
    let l = activate(emptyPage(), "a", size);
    l = updateRect(l, "a", { x: 11, y: 6, w: 33, h: 14 });
    const back = activate(deactivate(l, "a"), "a", size);
    expect(back.items).toEqual([{ id: "a", x: 11, y: 6, w: 33, h: 14 }]);
  });
});

describe("updateRect", () => {
  const base = layoutOf([
    { id: "a", x: 0, y: 0, w: 20, h: 10 },
    { id: "b", x: 200, y: 0, w: 20, h: 10 },
  ]);

  it("yalnız ilgili modülü günceller, diğerlerini olduğu gibi bırakır", () => {
    const out = updateRect(base, "a", { x: 3, y: 4, w: 21, h: 11 });
    expect(out.items[0]).toEqual({ id: "a", x: 3, y: 4, w: 21, h: 11 });
    expect(out.items[1]).toEqual(base.items[1]);
  });

  it("değişiklik yoksa aynı nesneyi döndürür", () => {
    expect(updateRect(base, "a", { x: 0, y: 0, w: 20, h: 10 })).toBe(base);
  });

  it("bilinmeyen modülü yok sayar", () => {
    expect(updateRect(base, "yok", { x: 1, y: 1, w: 1, h: 1 })).toBe(base);
  });

  it("geçersiz değerleri yok sayar", () => {
    expect(updateRect(base, "a", { x: -1, y: 0, w: 20, h: 10 })).toBe(base);
    expect(updateRect(base, "a", { x: 0, y: 0, w: 0, h: 10 })).toBe(base);
    expect(updateRect(base, "a", { x: NaN, y: 0, w: 20, h: 10 })).toBe(base);
  });
});

describe("sanitizeLayout", () => {
  it("geçerli düzeni olduğu gibi kabul eder", () => {
    const l = layoutOf([{ id: "a", x: 1, y: 2, w: 3, h: 4 }], { b: { x: 0, y: 0, w: 5, h: 5 } });
    const { tabs } = sanitizeLayout({ version: 1, ...l });
    expect({ items: tabs[0].items, parked: tabs[0].parked }).toEqual(l);
  });

  it("çöp veriyi boş düzene çevirir", () => {
    for (const v of [null, undefined, 5, "x", [], {}, { version: 3, items: [] }]) {
      expect(sanitizeLayout(v)).toEqual(emptyLayout());
    }
  });

  it("bozuk kayıtları atar, iyileri tutar", () => {
    const out = sanitizeLayout({
      version: 1,
      items: [
        { id: "ok", x: 0, y: 0, w: 5, h: 5 },
        { id: "bad", x: -1, y: 0, w: 5, h: 5 },
        { id: 5, x: 0, y: 0, w: 5, h: 5 },
        { id: "frac", x: 0.5, y: 0, w: 5, h: 5 },
        null,
      ],
      parked: { good: { x: 0, y: 0, w: 1, h: 1 }, worse: { x: 0, y: 0, w: 0, h: 1 } },
    });
    expect(out.tabs[0].items.map((i) => i.id)).toEqual(["ok"]);
    expect(Object.keys(out.tabs[0].parked)).toEqual(["good"]);
  });

  it("aynı id'yi tekrar etmez", () => {
    const out = sanitizeLayout({
      version: 1,
      items: [
        { id: "a", x: 0, y: 0, w: 5, h: 5 },
        { id: "a", x: 9, y: 9, w: 5, h: 5 },
      ],
    });
    expect(out.tabs[0].items).toEqual([{ id: "a", x: 0, y: 0, w: 5, h: 5 }]);
  });

  it("parked yoksa boş nesne kullanır", () => {
    expect(sanitizeLayout({ version: 1, items: [] }).tabs[0].parked).toEqual({});
  });
});
