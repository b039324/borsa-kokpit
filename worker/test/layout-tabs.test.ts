import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { signToken } from "../src/auth";
import { validateLayout } from "../src/layout";
import { makeEnv, req } from "./helpers";
import type { Env } from "../src/types";

const item = (id: string) => ({ id, x: 0, y: 0, w: 10, h: 10 });
const tab = (id: string, name: string, ids: string[] = []) => ({
  id,
  name,
  items: ids.map(item),
  parked: {},
});

const V2 = {
  version: 2,
  active: "t2",
  tabs: [tab("t1", "Hisse", ["grafik"]), tab("t2", "Piyasa", ["grafik", "hacim"])],
};

async function authed(env: Env, init: RequestInit = {}) {
  const token = await signToken(env.TOKEN_SECRET, 60);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return worker.fetch(req("/api/layout", { ...init, headers }), env);
}
const put = (env: Env, body: unknown) =>
  authed(env, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("layout v2 (sekmeler)", () => {
  it("v2 aynen geri okunur; aynı modül iki sekmede olabilir", async () => {
    const env = makeEnv();
    expect((await put(env, V2)).status).toBe(200);
    expect(await (await authed(env)).json()).toEqual({ layout: V2 });
  });

  it("v1 gövdesi tek sekmeli 'Sayfa 1' olarak taşınır", () => {
    const r = validateLayout({
      version: 1,
      items: [item("a")],
      parked: { b: { x: 1, y: 2, w: 3, h: 4 } },
    });
    expect(r).toEqual({
      ok: true,
      layout: {
        version: 2,
        active: "sayfa-1",
        tabs: [
          {
            id: "sayfa-1",
            name: "Sayfa 1",
            items: [item("a")],
            parked: { b: { x: 1, y: 2, w: 3, h: 4 } },
          },
        ],
      },
    });
  });

  it("KV'deki eski v1 kayıt GET'te v2 olarak döner", async () => {
    const env = makeEnv();
    await env.KOKPIT.put("layout:v1", JSON.stringify({ version: 1, items: [item("a")], parked: {} }));
    const res = (await (await authed(env)).json()) as { layout: { version: number; tabs: unknown[] } };
    expect(res.layout.version).toBe(2);
    expect(res.layout.tabs).toHaveLength(1);
  });

  it("active yoksa ya da bilinmiyorsa ilk sekme olur", () => {
    for (const active of [undefined, "yok", 5]) {
      const r = validateLayout({ ...V2, active });
      expect(r.ok && r.layout.version === 2 && r.layout.active).toBe("t1");
    }
  });

  it("sekme adı kırpılır; en çok 24 karakter", () => {
    const r = validateLayout({ ...V2, tabs: [tab("t1", "  Benim  ")] });
    expect(r.ok && r.layout.version === 2 && r.layout.tabs[0].name).toBe("Benim");
    expect(validateLayout({ ...V2, tabs: [tab("t1", "a".repeat(25))] }).ok).toBe(false);
    expect(validateLayout({ ...V2, tabs: [tab("t1", "a".repeat(24))] }).ok).toBe(true);
  });

  it("boş ad geçersiz", () => {
    expect(validateLayout({ ...V2, tabs: [tab("t1", "   ")] }).ok).toBe(false);
  });

  it("sekme sayısı 1..8", () => {
    expect(validateLayout({ version: 2, tabs: [] }).ok).toBe(false);
    const eight = Array.from({ length: 8 }, (_, i) => tab(`t${i}`, `S${i}`));
    expect(validateLayout({ version: 2, tabs: eight }).ok).toBe(true);
    expect(validateLayout({ version: 2, tabs: [...eight, tab("t9", "S9")] }).ok).toBe(false);
  });

  it("aynı sekme id iki kez geçersiz", () => {
    expect(validateLayout({ version: 2, tabs: [tab("t1", "A"), tab("t1", "B")] }).ok).toBe(false);
  });

  it("sekme id biçimi denetlenir", () => {
    expect(validateLayout({ version: 2, tabs: [tab("T 1", "A")] }).ok).toBe(false);
  });

  it("sekme içinde aynı modül iki kez geçersiz", () => {
    expect(validateLayout({ version: 2, tabs: [tab("t1", "A", ["x", "x"])] }).ok).toBe(false);
  });

  it("sekme içi öğe sınırı 100", () => {
    const many = Array.from({ length: 101 }, (_, i) => `m${i}`);
    expect(validateLayout({ version: 2, tabs: [tab("t1", "A", many)] }).ok).toBe(false);
  });

  it("bozuk sekme kaydı ve fazla alanlar", () => {
    expect(validateLayout({ version: 2, tabs: ["x"] }).ok).toBe(false);
    expect(validateLayout({ version: 2, tabs: "x" }).ok).toBe(false);
    const r = validateLayout({ version: 2, hack: 1, tabs: [{ ...tab("t1", "A"), ekstra: 1 }] });
    expect(r.ok && r.layout.version === 2 && Object.keys(r.layout.tabs[0]).sort()).toEqual([
      "id",
      "items",
      "name",
      "parked",
    ]);
  });

  it("sürüm 3 reddedilir ve 8 dolu sekme gövde sınırına sığar", async () => {
    expect(validateLayout({ version: 3, tabs: [] }).ok).toBe(false);
    const full = Array.from({ length: 8 }, (_, i) =>
      tab(`t${i}`, `S${i}`, Array.from({ length: 100 }, (_, j) => `modul-${j}`)),
    );
    const env = makeEnv();
    expect((await put(env, { version: 2, tabs: full })).status).toBe(200);
  });
});
