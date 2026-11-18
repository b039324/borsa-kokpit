import { describe, expect, it } from "vitest";
import { MAX_POSITIONS, validatePortfolio } from "../src/portfolio";

const pos = (symbol = "THYAO", qty: unknown = 100, cost: unknown = 250.5) => ({ symbol, qty, cost });

describe("validatePortfolio", () => {
  it("geçerli pozisyonları sırayla kabul eder", () => {
    const input = { positions: [pos("THYAO", 100, 250.5), pos("GARAN", 50, 120)] };
    expect(validatePortfolio(input)).toEqual({ ok: true, positions: input.positions });
  });
  it("boş portföy geçerli", () => {
    expect(validatePortfolio({ positions: [] })).toEqual({ ok: true, positions: [] });
  });
  it("fazladan alanları atar", () => {
    const r = validatePortfolio({ positions: [{ ...pos(), x: 1 }], y: 2 });
    expect(r).toEqual({ ok: true, positions: [pos()] });
  });
  it("kesirli adet ve maliyeti kabul eder", () => {
    expect(validatePortfolio({ positions: [pos("THYAO", 0.5, 0.01)] }).ok).toBe(true);
  });
  it.each([
    ["null", null],
    ["dizi", []],
    ["positions yok", {}],
    ["positions dizi değil", { positions: "x" }],
    ["pozisyon nesne değil", { positions: ["THYAO"] }],
    ["küçük harf sembol", { positions: [pos("thyao")] }],
    ["özel karakterli sembol", { positions: [pos("TH/YAO")] }],
    ["tekrarlı sembol", { positions: [pos("THYAO"), pos("THYAO", 5, 10)] }],
    ["adet 0", { positions: [pos("THYAO", 0)] }],
    ["adet negatif", { positions: [pos("THYAO", -1)] }],
    ["adet metin", { positions: [pos("THYAO", "100")] }],
    ["adet NaN", { positions: [pos("THYAO", NaN)] }],
    ["adet çok büyük", { positions: [pos("THYAO", 1e10)] }],
    ["maliyet 0", { positions: [pos("THYAO", 1, 0)] }],
    ["maliyet negatif", { positions: [pos("THYAO", 1, -5)] }],
    ["maliyet Infinity", { positions: [pos("THYAO", 1, Infinity)] }],
    ["maliyet çok büyük", { positions: [pos("THYAO", 1, 1e8)] }],
  ])("reddeder: %s", (_n, v) => {
    expect(validatePortfolio(v).ok).toBe(false);
  });
  it(`${MAX_POSITIONS}'dan fazlasını reddeder, tam sınırı kabul eder`, () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => pos(`S${String(i).padStart(3, "0")}`));
    expect(validatePortfolio({ positions: mk(MAX_POSITIONS) }).ok).toBe(true);
    expect(validatePortfolio({ positions: mk(MAX_POSITIONS + 1) }).ok).toBe(false);
  });
});
