import { describe, expect, it } from "vitest";
import { MAX_FAVORITES, validateFavorites } from "../src/favorites";

describe("validateFavorites", () => {
  it("geçerli listeyi sırayla kabul eder", () => {
    expect(validateFavorites({ symbols: ["THYAO", "GARAN"] })).toEqual({ ok: true, symbols: ["THYAO", "GARAN"] });
  });
  it("boş liste geçerli", () => {
    expect(validateFavorites({ symbols: [] })).toEqual({ ok: true, symbols: [] });
  });
  it("tekrarları atar", () => {
    expect(validateFavorites({ symbols: ["A1", "B2", "A1"] })).toEqual({ ok: true, symbols: ["A1", "B2"] });
  });
  it("fazladan alanları yok sayar", () => {
    expect(validateFavorites({ symbols: ["THYAO"], x: 1 })).toEqual({ ok: true, symbols: ["THYAO"] });
  });
  it.each([
    ["null", null],
    ["dizi", []],
    ["metin", "x"],
    ["symbols yok", {}],
    ["symbols dizi değil", { symbols: "THYAO" }],
    ["küçük harf", { symbols: ["thyao"] }],
    ["özel karakter", { symbols: ["TH/YAO"] }],
    ["çok kısa", { symbols: ["A"] }],
    ["çok uzun", { symbols: ["ABCDEFGHI"] }],
    ["sayı", { symbols: [5] }],
  ])("reddeder: %s", (_n, v) => {
    expect(validateFavorites(v).ok).toBe(false);
  });
  it(`${MAX_FAVORITES}'dan fazlasını reddeder, tam sınırı kabul eder`, () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => `S${String(i).padStart(3, "0")}`);
    expect(validateFavorites({ symbols: mk(MAX_FAVORITES) }).ok).toBe(true);
    expect(validateFavorites({ symbols: mk(MAX_FAVORITES + 1) }).ok).toBe(false);
  });
});
