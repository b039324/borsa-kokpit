import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useQuotes } from "./useQuotes";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const OPEN = () => new Date("2026-11-16T07:30:00Z");
const CLOSED = () => new Date("2026-11-14T09:00:00Z");
const reply = (u: string) => {
  const want = decodeURIComponent(u.split("symbols=")[1]).split(",");
  return { status: 200, body: { quotes: want.map((s) => ({ symbol: s, price: 10, prevClose: 9 })), failed: [] } };
};

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("useQuotes", () => {
  it("liste boşsa istek atmaz", () => {
    const f = mockFetch(reply);
    renderHook(() => useQuotes([]));
    expect(f).not.toHaveBeenCalled();
  });

  it("fiyatları sembole göre sözlüğe koyar", async () => {
    mockFetch(reply);
    const { result } = renderHook(() => useQuotes(["THYAO", "GARAN"], { now: CLOSED }));
    await waitFor(() => expect(result.current.quotes.THYAO?.price).toBe(10));
    expect(Object.keys(result.current.quotes)).toEqual(["THYAO", "GARAN"]);
  });

  it("20'den fazla sembolü 20'şerli parçalara böler", async () => {
    const list = Array.from({ length: 45 }, (_, i) => `AA${String(i).padStart(2, "0")}`);
    const f = mockFetch(reply);
    const { result } = renderHook(() => useQuotes(list, { now: CLOSED }));
    await waitFor(() => expect(Object.keys(result.current.quotes)).toHaveLength(45));
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("seans açıkken yeniler, kapalıyken yenilemez", async () => {
    const f1 = mockFetch(reply);
    const open = renderHook(() => useQuotes(["THYAO"], { now: OPEN, refreshMs: 20 }));
    await waitFor(() => expect(f1.mock.calls.length).toBeGreaterThanOrEqual(3));
    open.unmount(); // ilk deneme bitti; zamanlayıcısı ikinci denemeyi etkilemesin
    vi.unstubAllGlobals();

    const f2 = mockFetch(reply);
    const { result } = renderHook(() => useQuotes(["THYAO"], { now: CLOSED, refreshMs: 20 }));
    await waitFor(() => expect(result.current.quotes.THYAO).toBeDefined());
    await new Promise((r) => setTimeout(r, 120));
    expect(f2).toHaveBeenCalledTimes(1);
  });

  it("hata olunca eski fiyatlar kalır, hata işaretlenir", async () => {
    let n = 0;
    mockFetch((u) => (n++ === 0 ? reply(u) : { status: 502 }));
    const { result } = renderHook(() => useQuotes(["THYAO"], { now: OPEN, refreshMs: 20 }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.quotes.THYAO?.price).toBe(10);
  });

  it("liste değişince yeni listeyi sorar", async () => {
    const f = mockFetch(reply);
    const { rerender, result } = renderHook(({ l }) => useQuotes(l, { now: CLOSED }), { initialProps: { l: ["AAAA"] } });
    await waitFor(() => expect(result.current.quotes.AAAA).toBeDefined());
    rerender({ l: ["AAAA", "BBBB"] });
    await waitFor(() => expect(result.current.quotes.BBBB).toBeDefined());
    expect(String(f.mock.calls.at(-1)![0])).toContain("AAAA%2CBBBB");
  });
});
