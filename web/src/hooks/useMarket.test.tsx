import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMarket } from "./useMarket";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const item = { key: "XU100", label: "BIST 100", decimals: 2, price: 10, prevClose: 9 };
const OPEN = () => new Date("2026-11-16T07:30:00Z");
const CLOSED = () => new Date("2026-11-14T09:00:00Z");

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("useMarket", () => {
  it("piyasa verisini çeker (Bearer ile)", async () => {
    const f = mockFetch(() => ({ status: 200, body: { items: [item] } }));
    const { result } = renderHook(() => useMarket({ now: CLOSED }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(String(f.mock.calls[0][0])).toContain("/api/market");
    expect((f.mock.calls[0][1]?.headers as any).Authorization).toBe("Bearer tok");
  });

  it("seans açıkken yeniler", async () => {
    const f = mockFetch(() => ({ status: 200, body: { items: [item] } }));
    renderHook(() => useMarket({ now: OPEN, refreshMs: 20 }));
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it("seans kapalıyken yenilemez", async () => {
    const f = mockFetch(() => ({ status: 200, body: { items: [item] } }));
    const { result } = renderHook(() => useMarket({ now: CLOSED, refreshMs: 20 }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 120));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("hata olunca eski veri kalır, hata işaretlenir", async () => {
    let n = 0;
    mockFetch(() => (n++ === 0 ? { status: 200, body: { items: [item] } } : { status: 502 }));
    const { result } = renderHook(() => useMarket({ now: OPEN, refreshMs: 20 }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.items).toHaveLength(1);
  });
});
