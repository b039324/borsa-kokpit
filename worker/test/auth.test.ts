import { describe, it, expect } from "vitest";
import { signToken, verifyToken, safeEqual } from "../src/auth";

const SECRET = "test-gizli-anahtar-en-az-32-karakter!!";

describe("token", () => {
  it("imzalanan token doğrulanır", async () => {
    const t = await signToken(SECRET, 60);
    expect(await verifyToken(SECRET, t)).toBe(true);
  });

  it("yanlış anahtarla doğrulanmaz", async () => {
    const t = await signToken(SECRET, 60);
    expect(await verifyToken("baska-anahtar-baska-anahtar-123456", t)).toBe(false);
  });

  it("süresi dolan token reddedilir", async () => {
    const t = await signToken(SECRET, 60, 1_000_000);
    expect(await verifyToken(SECRET, t, 1_000_000 + 61_000)).toBe(false);
    expect(await verifyToken(SECRET, t, 1_000_000 + 59_000)).toBe(true);
  });

  it("kurcalanmış token reddedilir", async () => {
    const t = await signToken(SECRET, 60);
    const [payload, sig] = t.split(".");
    const forged = btoa(JSON.stringify({ exp: 9999999999 }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(await verifyToken(SECRET, `${forged}.${sig}`)).toBe(false);
    expect(await verifyToken(SECRET, `${payload}.AAAA`)).toBe(false);
  });

  it("bozuk biçimler reddedilir", async () => {
    expect(await verifyToken(SECRET, "")).toBe(false);
    expect(await verifyToken(SECRET, "tek-parca")).toBe(false);
    expect(await verifyToken(SECRET, "a.b.c")).toBe(false);
    expect(await verifyToken(SECRET, "!!!.???")).toBe(false);
  });
});

describe("safeEqual", () => {
  it("eşit ve farklı metinleri ayırt eder", async () => {
    expect(await safeEqual("abc", "abc")).toBe(true);
    expect(await safeEqual("abc", "abd")).toBe(false);
    expect(await safeEqual("abc", "abcd")).toBe(false);
    expect(await safeEqual("", "")).toBe(true);
  });
});
