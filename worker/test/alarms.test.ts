import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { MAX_ALARMS, validateAlarms } from "../src/alarms";
import { makeEnv, req, loginReq } from "./helpers";

const a = (over: any = {}) => ({ id: "a1", symbol: "THYAO", dir: "above", price: 350.5, createdAt: 1_700_000_000_000, ...over });

describe("validateAlarms", () => {
  it("geçerli alarmı kabul eder; triggeredAt isteğe bağlı", () => {
    const r = validateAlarms({ alarms: [a(), a({ id: "a2", dir: "below", triggeredAt: 1_700_000_100_000 })] });
    expect(r).toEqual({
      ok: true,
      alarms: [
        { id: "a1", symbol: "THYAO", dir: "above", price: 350.5, createdAt: 1_700_000_000_000, triggeredAt: null },
        { id: "a2", symbol: "THYAO", dir: "below", price: 350.5, createdAt: 1_700_000_000_000, triggeredAt: 1_700_000_100_000 },
      ],
    });
  });

  it("boş liste geçerli, fazladan alanlar atılır", () => {
    expect(validateAlarms({ alarms: [] })).toEqual({ ok: true, alarms: [] });
    const r = validateAlarms({ alarms: [a({ junk: 1 })] });
    expect(r.ok && Object.keys(r.alarms[0])).not.toContain("junk");
  });

  it.each([
    ["null", null],
    ["dizi", []],
    ["alarms yok", {}],
    ["alarms dizi değil", { alarms: "x" }],
    ["kötü sembol", { alarms: [a({ symbol: "thy/ao" })] }],
    ["kötü yön", { alarms: [a({ dir: "up" })] }],
    ["sıfır fiyat", { alarms: [a({ price: 0 })] }],
    ["negatif fiyat", { alarms: [a({ price: -1 })] }],
    ["sonsuz fiyat", { alarms: [a({ price: Infinity })] }],
    ["metin fiyat", { alarms: [a({ price: "5" })] }],
    ["kötü id", { alarms: [a({ id: "a b" })] }],
    ["boş id", { alarms: [a({ id: "" })] }],
    ["tekrar eden id", { alarms: [a(), a()] }],
    ["kötü createdAt", { alarms: [a({ createdAt: "x" })] }],
    ["kötü triggeredAt", { alarms: [a({ triggeredAt: "x" })] }],
  ])("reddeder: %s", (_n, v) => {
    expect(validateAlarms(v).ok).toBe(false);
  });

  it(`${MAX_ALARMS}'dan fazlasını reddeder`, () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => a({ id: `id${i}` }));
    expect(validateAlarms({ alarms: mk(MAX_ALARMS) }).ok).toBe(true);
    expect(validateAlarms({ alarms: mk(MAX_ALARMS + 1) }).ok).toBe(false);
  });
});

describe("/api/alarms", () => {
  async function auth() {
    const env = makeEnv();
    const res = await worker.fetch(loginReq("dogru-sifre"), env);
    const { token } = (await res.json()) as { token: string };
    return { env, h: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
  }

  it("giriş olmadan 401", async () => {
    expect((await worker.fetch(req("/api/alarms"), makeEnv())).status).toBe(401);
  });

  it("başta boş; PUT sonrası aynı alarmlar döner", async () => {
    const { env, h } = await auth();
    expect(await (await worker.fetch(req("/api/alarms", { headers: h }), env)).json()).toEqual({ alarms: [] });
    const put = await worker.fetch(req("/api/alarms", { method: "PUT", headers: h, body: JSON.stringify({ alarms: [a()] }) }), env);
    expect(put.status).toBe(200);
    const got: any = await (await worker.fetch(req("/api/alarms", { headers: h }), env)).json();
    expect(got.alarms).toHaveLength(1);
    expect(got.alarms[0].symbol).toBe("THYAO");
  });

  it("geçersiz gövde 400, bozuk JSON 400, büyük gövde 413", async () => {
    const { env, h } = await auth();
    const bad = await worker.fetch(req("/api/alarms", { method: "PUT", headers: h, body: JSON.stringify({ alarms: [a({ price: -1 })] }) }), env);
    expect(bad.status).toBe(400);
    const junk = await worker.fetch(req("/api/alarms", { method: "PUT", headers: h, body: "{" }), env);
    expect(junk.status).toBe(400);
    const big = await worker.fetch(req("/api/alarms", { method: "PUT", headers: h, body: JSON.stringify({ alarms: [], x: "y".repeat(20_000) }) }), env);
    expect(big.status).toBe(413);
  });

  it("desteklenmeyen yöntem 405", async () => {
    const { env, h } = await auth();
    expect((await worker.fetch(req("/api/alarms", { method: "DELETE", headers: h }), env)).status).toBe(405);
  });
});
