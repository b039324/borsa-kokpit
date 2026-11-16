import { describe, expect, it } from "vitest";
import { SYMBOL_LISTS } from "./symbols";

const CODE = /^[A-Z0-9]{2,8}$/;

describe("hisse listeleri", () => {
  it("BIST 30 tam 30 adet", () => {
    expect(SYMBOL_LISTS.BIST30).toHaveLength(30);
  });
  it("Ekim 2026 revizyonu: TRMET var, DSTKF yok", () => {
    expect(SYMBOL_LISTS.BIST30).toContain("TRMET");
    expect(SYMBOL_LISTS.BIST30).not.toContain("DSTKF");
  });
  it.each(["BIST30", "BIST100"] as const)("%s: kodlar geçerli ve tekrarsız", (k) => {
    const l = SYMBOL_LISTS[k];
    expect(l.every((s) => CODE.test(s))).toBe(true);
    expect(new Set(l).size).toBe(l.length);
  });
  it("BIST 100 tam 100 adet", () => {
    expect(SYMBOL_LISTS.BIST100).toHaveLength(100);
  });
  it("BIST 30'un tamamı BIST 100'de var", () => {
    for (const s of SYMBOL_LISTS.BIST30) expect(SYMBOL_LISTS.BIST100).toContain(s);
  });
});
