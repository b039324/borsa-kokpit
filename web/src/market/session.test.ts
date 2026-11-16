import { describe, expect, it } from "vitest";
import { isMarketOpen } from "./session";

// TR saati = UTC+3. 2026-11-16 Pazartesi.
const tr = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+03:00`);

describe("isMarketOpen", () => {
  it("hafta içi 10:00'da açık", () => expect(isMarketOpen(tr("2026-11-16", "10:00"))).toBe(true));
  it("10:00'dan önce kapalı", () => expect(isMarketOpen(tr("2026-11-16", "09:59"))).toBe(false));
  it("18:29'da hâlâ açık (gecikmeli veri payı)", () => expect(isMarketOpen(tr("2026-11-16", "18:29"))).toBe(true));
  it("18:30'da kapalı", () => expect(isMarketOpen(tr("2026-11-16", "18:30"))).toBe(false));
  it("cumartesi kapalı", () => expect(isMarketOpen(tr("2026-11-14", "12:00"))).toBe(false));
  it("pazar kapalı", () => expect(isMarketOpen(tr("2026-11-15", "12:00"))).toBe(false));
  it("tarayıcı saat dilimi fark etmez (UTC girdisi)", () =>
    expect(isMarketOpen(new Date("2026-11-16T07:00:00Z"))).toBe(true)); // 10:00 TR
});
