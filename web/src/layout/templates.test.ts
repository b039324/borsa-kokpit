import { describe, it, expect } from "vitest";
import { TEMPLATES, resolveTemplate } from "./templates";
import { registry } from "../modules";

describe("sayfa şablonları", () => {
  it("anahtarlar ve adlar benzersiz; en az 3 şablon", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => t.label)).size).toBe(TEMPLATES.length);
  });

  it("her şablondaki modül gerçekten kayıtlı (yazım hatası yok) ve yinelenmiyor", () => {
    for (const t of TEMPLATES) {
      expect(new Set(t.modules).size).toBe(t.modules.length);
      for (const id of t.modules) expect(registry.get(id), `${t.key}: ${id}`).toBeDefined();
    }
  });

  it("'Hisse' şablonu hisseye bağlı modüller, 'Piyasa' şablonu bağımsız modüller içerir", () => {
    const hisse = TEMPLATES.find((t) => t.key === "hisse")!;
    const piyasa = TEMPLATES.find((t) => t.key === "piyasa")!;
    expect(hisse.modules.every((id) => registry.get(id)!.scope === "stock")).toBe(true);
    expect(piyasa.modules.every((id) => registry.get(id)!.scope === "global")).toBe(true);
  });

  it("resolveTemplate kayıtlı olmayan modülleri atar ve boyutları verir", () => {
    const small = { get: (id: string) => (id === "grafik" ? registry.get("grafik") : undefined) } as typeof registry;
    const out = resolveTemplate({ key: "x", label: "X", modules: ["grafik", "yok"] }, small);
    expect(out.map((d) => d.id)).toEqual(["grafik"]);
    expect(out[0].defaultSize.w).toBeGreaterThan(0);
  });
});
