import { describe, expect, it } from "vitest";
import { ApiError } from "../api";
import { registry } from "../modules";
import { MODULE_CHECKS, buildChecks } from "./checks";
import { runDiagnostics } from "./runner";
import type { Check } from "./types";

const ok = (id: string): Check => ({ id, label: id, run: async () => ({ status: "ok", detail: "iyi" }) });

describe("runDiagnostics", () => {
  it("her kontrolü çalıştırır, süreyi ölçer ve ilerlemeyi bildirir", async () => {
    const seen: [number, number][] = [];
    let t = 0;
    const rep = await runDiagnostics({
      checks: [ok("a"), ok("b")],
      modules: [],
      now: () => (t += 50),
      onProgress: (d, n) => seen.push([d, n]),
    });
    expect(rep.checks.map((c) => c.id)).toEqual(["a", "b"]);
    expect(rep.checks.every((c) => c.ms > 0)).toBe(true);
    expect(seen).toEqual([[1, 2], [2, 2]]);
  });

  it("hata fırlatan kontrol 'fail' olur, mesajı yazılır, diğerleri sürer", async () => {
    const bad: Check = { id: "x", label: "x", run: async () => { throw new ApiError(500, "Veri alınamadı"); } };
    const rep = await runDiagnostics({ checks: [bad, ok("y")], modules: [] });
    expect(rep.checks[0]).toMatchObject({ status: "fail" });
    expect(rep.checks[0].detail).toContain("Veri alınamadı");
    expect(rep.checks[0].detail).toContain("500");
    expect(rep.checks[1].status).toBe("ok");
  });

  it("modül durumu bağlı kontrollerin en kötüsüdür (fail > warn > manual > ok)", async () => {
    const warn: Check = { id: "w", label: "w", run: async () => ({ status: "warn", detail: "eksik" }) };
    const rep = await runDiagnostics({
      checks: [ok("a"), warn],
      modules: [
        { id: "m1", title: "M1", checks: ["a", "w"] },
        { id: "m2", title: "M2", checks: ["a"] },
        { id: "m3", title: "M3", checks: [] },
      ],
    });
    const by = Object.fromEntries(rep.modules.map((m) => [m.id, m]));
    expect(by.m1.status).toBe("warn");
    expect(by.m1.detail).toContain("eksik");
    expect(by.m2.status).toBe("ok");
    expect(by.m3.status).toBe("ok");
    expect(by.m3.detail).toMatch(/veri gerektirmez/);
    expect(rep.counts).toEqual({ ok: 2, warn: 1, fail: 0, manual: 0 });
  });

  it("bağlı kontrol hiç çalışmadıysa modül 'warn' olur (sessiz geçmez)", async () => {
    const rep = await runDiagnostics({ checks: [], modules: [{ id: "m", title: "M", checks: ["yok"] }] });
    expect(rep.modules[0].status).toBe("warn");
  });

  it("iptal edilirse (signal) kalan kontroller çalışmaz", async () => {
    const ac = new AbortController();
    const first: Check = { id: "a", label: "a", run: async () => { ac.abort(); return { status: "ok", detail: "" }; } };
    const rep = await runDiagnostics({ checks: [first, ok("b")], modules: [], signal: ac.signal });
    expect(rep.checks.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("kapsama (modül ↔ kontrol)", () => {
  const api = {} as never;
  const ids = buildChecks("tok", "AKBNK", api).map((c) => c.id);

  it("her kayıtlı modülün kontrol listesi tanımlı (yeni modül eklenince bu test hatırlatır)", () => {
    const missing = registry.list.map((d) => d.id).filter((id) => !(id in MODULE_CHECKS));
    expect(missing).toEqual([]);
  });

  it("haritadaki her kontrol gerçekten var", () => {
    const unknown = Object.values(MODULE_CHECKS).flat().filter((c) => !ids.includes(c));
    expect([...new Set(unknown)]).toEqual([]);
  });

  it("haritada olup kayıtlı olmayan (silinmiş) modül yok", () => {
    const reg = new Set(registry.list.map((d) => d.id));
    expect(Object.keys(MODULE_CHECKS).filter((id) => !reg.has(id))).toEqual([]);
  });
});

describe("buildChecks", () => {
  it("sahte API ile kontroller çalışır; chart 7 dönem ister", async () => {
    const calls: string[] = [];
    const api = {
      getMarket: async () => { calls.push("market"); return [{ price: 1 }]; },
      getChart: async (_t: string, s: string, p: string) => { calls.push(`chart:${s}:${p}`); return { price: 1, candles: [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }] }; },
    } as never;
    const checks = buildChecks("tok", "THYAO", api);
    const run = (id: string) => checks.find((c) => c.id === id)!.run();
    expect((await run("market")).status).toBe("ok");
    const periods = checks.filter((c) => c.id.startsWith("chart-")).map((c) => c.id);
    expect(periods).toEqual(["chart-1g", "chart-1h", "chart-1a", "chart-3a", "chart-6a", "chart-1y", "chart-5y"]);
    expect((await run("chart-1g")).status).toBe("ok");
    expect(calls).toContain("chart:THYAO:1g");
  });

  it("youtube kontrolü 'manual' döner (otomatik doğrulanamaz)", async () => {
    const c = buildChecks("tok", "AKBNK", {} as never).find((x) => x.id === "youtube")!;
    expect((await c.run()).status).toBe("manual");
  });
});
