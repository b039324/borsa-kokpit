import { describe, expect, it } from "vitest";
import { evaluateAlarms, isTriggered, describeAlarm } from "./logic";

const al = (over: any = {}) => ({ id: "a1", symbol: "THYAO", dir: "above", price: 350, createdAt: 1, triggeredAt: null, ...over });

describe("isTriggered", () => {
  it("yukarı alarm: fiyat hedefe eşit ya da üstündeyse", () => {
    expect(isTriggered(al(), 349.99)).toBe(false);
    expect(isTriggered(al(), 350)).toBe(true);
    expect(isTriggered(al(), 360)).toBe(true);
  });
  it("aşağı alarm: fiyat hedefe eşit ya da altındaysa", () => {
    expect(isTriggered(al({ dir: "below" }), 350.01)).toBe(false);
    expect(isTriggered(al({ dir: "below" }), 350)).toBe(true);
    expect(isTriggered(al({ dir: "below" }), 300)).toBe(true);
  });
});

describe("evaluateAlarms", () => {
  const quotes = { THYAO: { symbol: "THYAO", price: 360, prevClose: 340 }, GARAN: { symbol: "GARAN", price: 100, prevClose: 99 } };

  it("koşulu sağlayanı tetikler, zamanı işler ve fired listesinde döner", () => {
    const list = [al(), al({ id: "a2", symbol: "GARAN", price: 120 })];
    const r = evaluateAlarms(list as any, quotes as any, 5000);
    expect(r.fired.map((f) => f.alarm.id)).toEqual(["a1"]);
    expect(r.alarms[0].triggeredAt).toBe(5000);
    expect(r.alarms[1].triggeredAt).toBeNull();
    expect(r.changed).toBe(true);
  });

  it("zaten tetiklenmiş alarmı yeniden tetiklemez", () => {
    const r = evaluateAlarms([al({ triggeredAt: 10 })] as any, quotes as any, 5000);
    expect(r.fired).toEqual([]);
    expect(r.changed).toBe(false);
    expect(r.alarms[0].triggeredAt).toBe(10);
  });

  it("fiyatı gelmeyen hisse için bir şey yapmaz", () => {
    const r = evaluateAlarms([al({ symbol: "ASELS" })] as any, quotes as any, 5000);
    expect(r.fired).toEqual([]);
    expect(r.changed).toBe(false);
  });

  it("fiyatı null olan kotasyonu yok sayar", () => {
    const r = evaluateAlarms([al()] as any, { THYAO: { symbol: "THYAO", price: null, prevClose: null } } as any, 5000);
    expect(r.changed).toBe(false);
  });
});

describe("describeAlarm", () => {
  it("yöne göre metin", () => {
    expect(describeAlarm(al() as any)).toBe("Üstüne çıkınca");
    expect(describeAlarm(al({ dir: "below" }) as any)).toBe("Altına inince");
  });
});
