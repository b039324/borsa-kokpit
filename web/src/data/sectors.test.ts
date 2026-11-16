import { describe, expect, it } from "vitest";
import { SECTORS } from "./sectors";
import { SYMBOL_LISTS } from "./symbols";

const all = Object.values(SECTORS).flat();

describe("sektör eşleşmesi", () => {
  it("BIST 100'ün her hissesi tam bir sektörde (eksik yok)", () => {
    expect([...all].sort()).toEqual([...SYMBOL_LISTS.BIST100].sort());
  });
  it("hiçbir hisse iki sektörde değil", () => {
    expect(new Set(all).size).toBe(all.length);
  });
  it("boş sektör yok", () => {
    for (const [k, v] of Object.entries(SECTORS)) expect(v.length, k).toBeGreaterThan(0);
  });
  it("bilinen örnekler doğru sektörde", () => {
    expect(SECTORS["Banka"]).toContain("GARAN");
    expect(SECTORS["Ulaştırma"]).toContain("THYAO");
    expect(SECTORS["İletişim"]).toEqual(["TCELL", "TTKOM"]);
  });
});
