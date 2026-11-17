import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { signToken } from "../src/auth";
import { makeEnv, req } from "./helpers";
import type { Env } from "../src/types";

// Eski (sürüm 1) gövdenin sunucuda taşınmış hâli.
const mig = (items: unknown[], parked: unknown = {}) => ({
  version: 2,
  active: "sayfa-1",
  tabs: [{ id: "sayfa-1", name: "Sayfa 1", items, parked }],
});

const GOOD = {
  version: 1,
  items: [
    { id: "grafik", x: 0, y: 0, w: 30, h: 20 },
    { id: "hacim", x: 30, y: 0, w: 20, h: 10 },
  ],
  parked: { sinyal: { x: 5, y: 5, w: 10, h: 8 } },
};

async function authed(env: Env, init: RequestInit = {}, path = "/api/layout") {
  const token = await signToken(env.TOKEN_SECRET, 60);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return worker.fetch(req(path, { ...init, headers }), env);
}

function put(env: Env, body: unknown) {
  return authed(env, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/layout erişim", () => {
  it("token olmadan GET 401", async () => {
    expect((await worker.fetch(req("/api/layout"), makeEnv())).status).toBe(401);
  });

  it("token olmadan PUT 401", async () => {
    const res = await worker.fetch(
      req("/api/layout", { method: "PUT", body: JSON.stringify(GOOD) }),
      makeEnv(),
    );
    expect(res.status).toBe(401);
  });

  it("desteklenmeyen yöntem 405", async () => {
    expect((await authed(makeEnv(), { method: "POST", body: "{}" })).status).toBe(405);
    expect((await authed(makeEnv(), { method: "DELETE" })).status).toBe(405);
  });
});

describe("/api/layout okuma ve yazma", () => {
  it("kayıt yoksa layout null döner", async () => {
    const res = await authed(makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ layout: null });
  });

  it("yazılan düzen aynen geri okunur", async () => {
    const env = makeEnv();
    const w = await put(env, GOOD);
    expect(w.status).toBe(200);
    expect(await w.json()).toEqual({ ok: true });
    const r = await authed(env);
    expect(await r.json()).toEqual({ layout: mig(GOOD.items, GOOD.parked) });
  });

  it("ikinci yazma ilkinin üzerine yazar", async () => {
    const env = makeEnv();
    await put(env, GOOD);
    const next = { version: 1, items: [{ id: "x", x: 1, y: 2, w: 3, h: 4 }], parked: {} };
    await put(env, next);
    expect(await (await authed(env)).json()).toEqual({ layout: mig(next.items) });
  });

  it("boş düzen geçerlidir", async () => {
    const env = makeEnv();
    const empty = { version: 1, items: [], parked: {} };
    expect((await put(env, empty)).status).toBe(200);
    expect(await (await authed(env)).json()).toEqual({ layout: mig([]) });
  });

  it("parked alanı yoksa boş kabul edilir", async () => {
    const env = makeEnv();
    expect((await put(env, { version: 1, items: [] })).status).toBe(200);
    expect(await (await authed(env)).json()).toEqual({ layout: mig([]) });
  });

  it("fazladan alanlar atılır", async () => {
    const env = makeEnv();
    await put(env, {
      version: 1,
      hack: "x",
      items: [{ id: "a", x: 0, y: 0, w: 1, h: 1, ekstra: true }],
      parked: {},
    });
    expect(await (await authed(env)).json()).toEqual({
      layout: mig([{ id: "a", x: 0, y: 0, w: 1, h: 1 }]),
    });
  });

  it("bozuk KV kaydı null döner, hata vermez", async () => {
    const env = makeEnv();
    await env.KOKPIT.put("layout:v1", "{bozuk");
    expect(await (await authed(env)).json()).toEqual({ layout: null });
  });
});

describe("/api/layout doğrulama", () => {
  const bad: [string, unknown][] = [
    ["sürüm yanlış", { ...GOOD, version: 3 }],
    ["items dizi değil", { ...GOOD, items: "x" }],
    ["gövde dizi", []],
    ["gövde null", null],
    ["id büyük harf", { version: 1, items: [{ id: "Grafik", x: 0, y: 0, w: 1, h: 1 }] }],
    ["id boş", { version: 1, items: [{ id: "", x: 0, y: 0, w: 1, h: 1 }] }],
    ["id çok uzun", { version: 1, items: [{ id: "a".repeat(65), x: 0, y: 0, w: 1, h: 1 }] }],
    ["x negatif", { version: 1, items: [{ id: "a", x: -1, y: 0, w: 1, h: 1 }] }],
    ["x ondalık", { version: 1, items: [{ id: "a", x: 1.5, y: 0, w: 1, h: 1 }] }],
    ["x metin", { version: 1, items: [{ id: "a", x: "1", y: 0, w: 1, h: 1 }] }],
    ["w sıfır", { version: 1, items: [{ id: "a", x: 0, y: 0, w: 0, h: 1 }] }],
    ["h çok büyük", { version: 1, items: [{ id: "a", x: 0, y: 0, w: 1, h: 1001 }] }],
    ["y çok büyük", { version: 1, items: [{ id: "a", x: 0, y: 10001, w: 1, h: 1 }] }],
    [
      "aynı id iki kez",
      {
        version: 1,
        items: [
          { id: "a", x: 0, y: 0, w: 1, h: 1 },
          { id: "a", x: 5, y: 5, w: 1, h: 1 },
        ],
      },
    ],
    [
      "çok fazla öğe",
      {
        version: 1,
        items: Array.from({ length: 101 }, (_, i) => ({ id: `m${i}`, x: 0, y: 0, w: 1, h: 1 })),
      },
    ],
    ["parked bozuk dikdörtgen", { version: 1, items: [], parked: { a: { x: 0, y: 0, w: 0, h: 1 } } }],
    ["parked anahtar geçersiz", { version: 1, items: [], parked: { "A B": { x: 0, y: 0, w: 1, h: 1 } } }],
    ["parked dizi", { version: 1, items: [], parked: [] }],
  ];

  it.each(bad)("%s: 400 döner ve kayıt yazılmaz", async (_ad, body) => {
    const env = makeEnv();
    const res = await put(env, body);
    expect(res.status).toBe(400);
    expect(typeof ((await res.json()) as { error: string }).error).toBe("string");
    expect(await env.KOKPIT.get("layout:v1")).toBeNull();
  });

  it("bozuk JSON 400", async () => {
    expect((await put(makeEnv(), "{bozuk")).status).toBe(400);
  });

  it("çok büyük gövde 413", async () => {
    const env = makeEnv();
    const big = JSON.stringify({ version: 1, items: [], parked: {}, pad: "x".repeat(120_000) });
    expect((await put(env, big)).status).toBe(413);
    expect(await env.KOKPIT.get("layout:v1")).toBeNull();
  });
});
