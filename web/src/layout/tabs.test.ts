import { describe, it, expect } from "vitest";
import {
  MAX_TABS,
  activePage,
  addTab,
  emptyLayout,
  moveTab,
  removeTab,
  renameTab,
  sanitizeLayout,
  selectTab,
  updateActivePage,
  activate,
  type Layout,
  type Tab,
} from "./model";

const tab = (id: string, name = id, ids: string[] = []): Tab => ({
  id,
  name,
  items: ids.map((i) => ({ id: i, x: 0, y: 0, w: 5, h: 5 })),
  parked: {},
});
const L = (tabs: Tab[], active = tabs[0].id): Layout => ({ version: 2, active, tabs });
const names = (l: Layout) => l.tabs.map((t) => t.name);
const ids = (l: Layout) => l.tabs.map((t) => t.id);

describe("emptyLayout", () => {
  it("tek boş 'Sayfa 1' sekmesiyle başlar", () => {
    const l = emptyLayout();
    expect(l.version).toBe(2);
    expect(names(l)).toEqual(["Sayfa 1"]);
    expect(l.active).toBe(l.tabs[0].id);
    expect(l.tabs[0].items).toEqual([]);
  });
});

describe("addTab", () => {
  it("boş sayfa ekler, etkin yapar, adı 'Sayfa N'", () => {
    const l = addTab(emptyLayout());
    expect(names(l)).toEqual(["Sayfa 1", "Sayfa 2"]);
    expect(l.active).toBe(l.tabs[1].id);
    expect(l.tabs[1].items).toEqual([]);
  });

  it("kullanılmayan en küçük numarayı seçer; kimlikler benzersiz", () => {
    let l = addTab(addTab(emptyLayout())); // 1,2,3
    l = removeTab(l, l.tabs[1].id); // 1,3
    l = addTab(l);
    expect(names(l)).toEqual(["Sayfa 1", "Sayfa 3", "Sayfa 2"]);
    expect(new Set(ids(l)).size).toBe(3);
  });

  it("kullanıcı 'Sayfa 2' adını başka sekmeye verdiyse çakışmaz", () => {
    let l = renameTab(emptyLayout(), emptyLayout().tabs[0].id, "Sayfa 2");
    l = addTab(l);
    expect(names(l)).toEqual(["Sayfa 2", "Sayfa 3"]);
  });

  it("en çok 8 sekme", () => {
    let l = emptyLayout();
    for (let i = 0; i < 20; i++) l = addTab(l);
    expect(l.tabs).toHaveLength(MAX_TABS);
    expect(addTab(l)).toBe(l);
  });
});

describe("removeTab", () => {
  it("son sekme silinemez", () => {
    const l = L([tab("a")]);
    expect(removeTab(l, "a")).toBe(l);
  });

  it("bilinmeyen kimlik değişiklik yapmaz", () => {
    const l = L([tab("a"), tab("b")]);
    expect(removeTab(l, "x")).toBe(l);
  });

  it("etkin olmayan sekmeyi silince etkin aynı kalır", () => {
    const l = removeTab(L([tab("a"), tab("b"), tab("c")], "c"), "a");
    expect(ids(l)).toEqual(["b", "c"]);
    expect(l.active).toBe("c");
  });

  it("etkin sekmeyi silince komşusu etkin olur (sağdaki, yoksa soldaki)", () => {
    expect(removeTab(L([tab("a"), tab("b"), tab("c")], "b"), "b").active).toBe("c");
    expect(removeTab(L([tab("a"), tab("b"), tab("c")], "c"), "c").active).toBe("b");
  });

  it("ilk sekme de silinebilir", () => {
    const l = removeTab(L([tab("a"), tab("b")], "a"), "a");
    expect(ids(l)).toEqual(["b"]);
    expect(l.active).toBe("b");
  });
});

describe("renameTab", () => {
  it("adı kırpar ve değiştirir", () => {
    expect(names(renameTab(L([tab("a")]), "a", "  Piyasa "))).toEqual(["Piyasa"]);
  });
  it("boş ad ya da 24+ karakter reddedilir", () => {
    const l = L([tab("a", "Eski")]);
    expect(renameTab(l, "a", "   ")).toBe(l);
    expect(renameTab(l, "a", "x".repeat(25))).toBe(l);
    expect(names(renameTab(l, "a", "x".repeat(24)))).toEqual(["x".repeat(24)]);
  });
  it("aynı ad ya da bilinmeyen kimlik değişiklik yapmaz", () => {
    const l = L([tab("a", "Eski")]);
    expect(renameTab(l, "a", "Eski")).toBe(l);
    expect(renameTab(l, "yok", "Yeni")).toBe(l);
  });
});

describe("moveTab", () => {
  const l = L([tab("a"), tab("b"), tab("c"), tab("d")]);
  it("sekmeyi hedefin yerine taşır", () => {
    expect(ids(moveTab(l, "a", "c"))).toEqual(["b", "c", "a", "d"]);
    expect(ids(moveTab(l, "d", "b"))).toEqual(["a", "d", "b", "c"]);
  });
  it("etkin sekme değişmez", () => {
    expect(moveTab({ ...l, active: "b" }, "a", "d").active).toBe("b");
  });
  it("aynı yer ya da bilinmeyen kimlik değişiklik yapmaz", () => {
    expect(moveTab(l, "a", "a")).toBe(l);
    expect(moveTab(l, "a", "x")).toBe(l);
    expect(moveTab(l, "x", "a")).toBe(l);
  });
});

describe("selectTab", () => {
  it("etkin sekmeyi değiştirir; bilinmeyen/aynı kimlik değişiklik yapmaz", () => {
    const l = L([tab("a"), tab("b")]);
    expect(selectTab(l, "b").active).toBe("b");
    expect(selectTab(l, "a")).toBe(l);
    expect(selectTab(l, "x")).toBe(l);
  });
});

describe("etkin sayfa üzerinde çalışma", () => {
  it("activePage etkin sekmeyi verir", () => {
    expect(activePage(L([tab("a"), tab("b")], "b")).id).toBe("b");
  });

  it("updateActivePage yalnız etkin sekmeyi değiştirir; aynı modül iki sekmede olabilir", () => {
    const start = L([tab("a"), tab("b")], "a");
    const l1 = updateActivePage(start, (p) => activate(p, "grafik", { w: 10, h: 5 }));
    const l2 = updateActivePage(selectTab(l1, "b"), (p) => activate(p, "grafik", { w: 10, h: 5 }));
    expect(l2.tabs[0].items.map((i) => i.id)).toEqual(["grafik"]);
    expect(l2.tabs[1].items.map((i) => i.id)).toEqual(["grafik"]);
  });

  it("değişiklik yoksa aynı nesne döner", () => {
    const l = L([tab("a")]);
    expect(updateActivePage(l, (p) => p)).toBe(l);
  });
});

describe("sanitizeLayout (sekmeli)", () => {
  it("v1 düzeni tek 'Sayfa 1' sekmesine taşır, hiçbir şey kaybolmaz", () => {
    const out = sanitizeLayout({
      version: 1,
      items: [{ id: "a", x: 1, y: 2, w: 3, h: 4 }],
      parked: { b: { x: 0, y: 0, w: 5, h: 5 } },
    });
    expect(out.version).toBe(2);
    expect(names(out)).toEqual(["Sayfa 1"]);
    expect(out.tabs[0].items).toEqual([{ id: "a", x: 1, y: 2, w: 3, h: 4 }]);
    expect(Object.keys(out.tabs[0].parked)).toEqual(["b"]);
    expect(out.active).toBe(out.tabs[0].id);
  });

  it("geçerli v2'yi olduğu gibi kabul eder", () => {
    const l = L([tab("t1", "Hisse", ["a"]), tab("t2", "Piyasa", ["a", "b"])], "t2");
    expect(sanitizeLayout(l)).toEqual(l);
  });

  it("bozuk sekmeleri atar; hiç geçerli kalmazsa boş düzen", () => {
    const out = sanitizeLayout({
      version: 2,
      tabs: [tab("ok", "A"), { id: "BÜYÜK", name: "x", items: [], parked: {} }, null, tab("ok", "B")],
    });
    expect(ids(out)).toEqual(["ok"]);
    expect(sanitizeLayout({ version: 2, tabs: [] })).toEqual(emptyLayout());
    expect(sanitizeLayout({ version: 2 })).toEqual(emptyLayout());
  });

  it("geçersiz adı kimlikten türetir, uzun adı keser, 8'den fazlasını atar", () => {
    const out = sanitizeLayout({
      version: 2,
      tabs: [
        { id: "t1", name: "", items: [], parked: {} },
        { id: "t2", name: "y".repeat(40), items: [], parked: {} },
        ...Array.from({ length: 10 }, (_, i) => tab(`x${i}`)),
      ],
    });
    expect(out.tabs).toHaveLength(MAX_TABS);
    expect(out.tabs[0].name.length).toBeGreaterThan(0);
    expect(out.tabs[1].name).toBe("y".repeat(24));
  });

  it("bilinmeyen active ilk sekmeye düşer", () => {
    expect(sanitizeLayout({ ...L([tab("a"), tab("b")]), active: "yok" }).active).toBe("a");
  });

  it("sekme içindeki bozuk modül kayıtlarını atar", () => {
    const t = { ...tab("a"), items: [{ id: "ok", x: 0, y: 0, w: 5, h: 5 }, { id: "x", x: -1, y: 0, w: 5, h: 5 }] };
    expect(sanitizeLayout({ version: 2, tabs: [t] }).tabs[0].items.map((i) => i.id)).toEqual(["ok"]);
  });
});
