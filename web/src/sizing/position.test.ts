import { describe, it, expect } from "vitest";
import { calcPosition, parseNum } from "./position";

describe("parseNum", () => {
  it("virgül ve nokta ondalığını, binlik boşluğu kabul eder", () => {
    expect(parseNum("12,5")).toBe(12.5);
    expect(parseNum("12.5")).toBe(12.5);
    expect(parseNum(" 100 000 ")).toBe(100000);
  });
  it("boş/geçersiz/sıfır altı → null", () => {
    for (const v of ["", "abc", "-3", "0", "1e999"]) expect(parseNum(v)).toBeNull();
  });
});

describe("calcPosition", () => {
  const base = { capital: 100_000, riskPct: 1, entry: 100, stop: 95, target: 115 };

  it("alım: adet, risk/ödül ve TL tutarları", () => {
    const r = calcPosition(base)!;
    expect(r.side).toBe("al");
    expect(r.riskPerShare).toBe(5);
    expect(r.rewardPerShare).toBe(15);
    expect(r.rr).toBe(3);
    expect(r.riskTl).toBe(1000);
    expect(r.shares).toBe(200); // 1000 / 5
    expect(r.value).toBe(20_000);
    expect(r.lossTl).toBe(1000);
    expect(r.gainTl).toBe(3000);
    expect(r.valuePct).toBeCloseTo(20);
    expect(r.exceedsCapital).toBe(false);
  });

  it("açığa satış: stop girişin üstünde", () => {
    const r = calcPosition({ ...base, stop: 105, target: 85 })!;
    expect(r.side).toBe("sat");
    expect(r.rr).toBe(3);
    expect(r.shares).toBe(200);
  });

  it("adet aşağı yuvarlanır", () => {
    expect(calcPosition({ ...base, riskPct: 1, stop: 97 })!.shares).toBe(333); // 1000/3
  });

  it("pozisyon sermayeyi aşarsa bunu işaretler ve sermayeye sığan adedi verir", () => {
    const r = calcPosition({ ...base, stop: 99.5 })!; // 1000/0.5 = 2000 adet = 200.000 TL
    expect(r.shares).toBe(2000);
    expect(r.exceedsCapital).toBe(true);
    expect(r.maxSharesByCapital).toBe(1000);
  });

  it("hedef yanlış yöndeyse hedef verisi null (uyarı için)", () => {
    const r = calcPosition({ ...base, target: 90 })!;
    expect(r.targetOk).toBe(false);
    expect(r.rr).toBeNull();
    expect(r.gainTl).toBeNull();
  });

  it("hedef verilmezse yalnız risk hesaplanır", () => {
    const r = calcPosition({ ...base, target: null })!;
    expect(r.rr).toBeNull();
    expect(r.shares).toBe(200);
    expect(r.targetOk).toBe(true);
  });

  it("stop = giriş ya da eksik veri → null", () => {
    expect(calcPosition({ ...base, stop: 100 })).toBeNull();
    expect(calcPosition({ ...base, entry: null })).toBeNull();
    expect(calcPosition({ ...base, stop: null })).toBeNull();
    expect(calcPosition({ ...base, capital: null })).toBeNull();
    expect(calcPosition({ ...base, riskPct: null })).toBeNull();
  });

  it("risk yüzdesi sermayeyi aşamaz (>100 → null)", () => {
    expect(calcPosition({ ...base, riskPct: 101 })).toBeNull();
  });
});
