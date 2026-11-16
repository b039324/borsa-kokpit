import { describe, it, expect } from "vitest";
import { createRegistry } from "./registry";
import { registry } from "./index";
import type { ModuleDef } from "./types";

const Dummy = () => null;

function def(over: Partial<ModuleDef> = {}): ModuleDef {
  return {
    id: "test",
    title: "Test",
    scope: "global",
    defaultSize: { w: 10, h: 10 },
    component: Dummy,
    ...over,
  };
}

describe("createRegistry", () => {
  it("modülleri id ile bulur", () => {
    const r = createRegistry([def({ id: "a" }), def({ id: "b" })]);
    expect(r.get("a")?.id).toBe("a");
    expect(r.get("yok")).toBeUndefined();
  });

  it("aynı id iki kez kayıtlıysa hata verir", () => {
    expect(() => createRegistry([def({ id: "a" }), def({ id: "a" })])).toThrow(/a/);
  });

  it("geçersiz id hata verir", () => {
    for (const id of ["Grafik", "a b", "", "ç", "a".repeat(65)]) {
      expect(() => createRegistry([def({ id })])).toThrow();
    }
  });

  it("geçersiz varsayılan boyut hata verir", () => {
    expect(() => createRegistry([def({ defaultSize: { w: 0, h: 5 } })])).toThrow();
    expect(() => createRegistry([def({ defaultSize: { w: 2.5, h: 5 } })])).toThrow();
  });

  it("önce order'a, sonra başlığa göre sıralar", () => {
    const r = createRegistry([
      def({ id: "c", title: "Zeta", order: 20 }),
      def({ id: "a", title: "Şu", order: 10 }),
      def({ id: "b", title: "Alfa", order: 10 }),
      def({ id: "d", title: "Son" }),
    ]);
    expect(r.list.map((m) => m.id)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("gerçek kayıt", () => {
  it("*.module.tsx dosyaları otomatik kayıt olur", () => {
    const ids = registry.list.map((m) => m.id);
    expect(ids).toContain("ornek-hisse");
    expect(ids).toContain("ornek-saat");
  });

  it("her modülün kapsamı ve boyutu geçerlidir", () => {
    for (const m of registry.list) {
      expect(["stock", "global"]).toContain(m.scope);
      expect(m.defaultSize.w).toBeGreaterThan(0);
      expect(m.defaultSize.h).toBeGreaterThan(0);
    }
  });
});
