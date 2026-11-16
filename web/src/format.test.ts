import { describe, expect, it } from "vitest";
import { compact, nf } from "./format";

describe("format", () => {
  it("nf Türkçe ondalık", () => expect(nf(1234.5)).toBe("1.234,50"));
  it("compact milyar", () => expect(compact(1_200_000_000)).toBe("1,20 mr"));
  it("compact milyon", () => expect(compact(3_000_000)).toBe("3,00 mn"));
  it("compact küçük sayı", () => expect(compact(950)).toBe("950"));
  it("compact eksi değerde de çalışır", () => expect(compact(-2_500_000)).toBe("-2,50 mn"));
});
