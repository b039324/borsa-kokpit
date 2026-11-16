import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChart } from "./useChart";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const chart = (price: number) => ({
  symbol: "X", period: "1g", currency: "TRY", price, prevClose: 100, gmtoffset: 10800,
  candles: [{ t: 1, o: 1, h: 2, l: 0, c: price, v: 1 }],
});
const OPEN = () => new Date("2026-11-16T07:30:00Z"); // 10:30 TR, Pazartesi
const CLOSED = () => new Date("2026-11-14T09:00:00Z"); // Cumartesi

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("useChart", () => {
  it("hisse seçili değilse istek atmaz", () => {
    const f = mockFetch(() => ({ status: 200, body: chart(1) }));
    renderHook(() => useChart(null, "1g"));
    expect(f).not.toHaveBeenCalled();
  });

  it("hisse seçilince veriyi Bearer ile çeker", async () => {
    const f = mockFetch(() => ({ status: 200, body: chart(110) }));
    const { result } = renderHook(() => useChart("THYAO", "1g", { now: OPEN }));
    await waitFor(() => expect(result.current.data?.price).toBe(110));
    expect(String(f.mock.calls[0][0])).toContain("/api/chart?symbol=THYAO&period=1g");
    expect((f.mock.calls[0][1]?.headers as any).Authorization).toBe("Bearer tok");
    expect(result.current.marketOpen).toBe(true);
  });

  it("seans açıkken periyodik yeniler", async () => {
    const f = mockFetch(() => ({ status: 200, body: chart(110) }));
    renderHook(() => useChart("THYAO", "1g", { now: OPEN, refreshMs: 20 }));
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it("seans kapalıyken yalnız bir kez çeker, yenilemez", async () => {
    const f = mockFetch(() => ({ status: 200, body: chart(110) }));
    const { result } = renderHook(() => useChart("THYAO", "1g", { now: CLOSED, refreshMs: 20 }));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await new Promise((r) => setTimeout(r, 120));
    expect(f).toHaveBeenCalledTimes(1);
    expect(result.current.marketOpen).toBe(false);
  });

  it("yenileme hata verirse eski veri kalır, hata işaretlenir", async () => {
    let n = 0;
    mockFetch(() => (n++ === 0 ? { status: 200, body: chart(110) } : { status: 502 }));
    const { result } = renderHook(() => useChart("THYAO", "1g", { now: OPEN, refreshMs: 20 }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data?.price).toBe(110);
  });

  it("hisse değişince eski hissenin verisi kalmaz", async () => {
    mockFetch((u) => ({ status: 200, body: chart(u.includes("AAAA") ? 11 : 22) }));
    const { result, rerender } = renderHook(({ s }) => useChart(s, "1g", { now: CLOSED }), {
      initialProps: { s: "AAAA" },
    });
    await waitFor(() => expect(result.current.data?.price).toBe(11));
    rerender({ s: "BBBB" });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data?.price).toBe(22));
  });

  it("404'te hata mesajı verir", async () => {
    mockFetch(() => ({ status: 404 }));
    const { result } = renderHook(() => useChart("ZZZZ", "1g", { now: CLOSED }));
    await waitFor(() => expect(result.current.error).toBe("Hisse bulunamadı"));
  });
});
