import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./hacim-tl.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const T0 = Date.UTC(2026, 10, 10, 7, 0, 0) / 1000; // 10:00 TR

const mk = (candles: any[]) => ({
  symbol: "X", period: "x", currency: "TRY", price: 10, prevClose: 10, gmtoffset: 10800, candles,
});
const bar = (i: number, close: number, v: number, up = true) => ({
  t: T0 + i * 300, o: up ? close - 1 : close + 1, h: close + 2, l: close - 2, c: close, v,
});
// gün içi: 3 mum → TL = 10×100 + 10×200 + 10×300 = 6000
const intraday = mk([bar(0, 10, 100), bar(1, 10, 200, false), bar(2, 10, 300)]);
// günlük: 25 gün × 1000 TL + bugün (ortalamaya girmez)
const daily = mk([...Array.from({ length: 25 }, (_, i) => ({ ...bar(i, 10, 100), t: T0 + i * 86400 })), bar(99, 10, 999_999)]);

function api() {
  return mockFetch((u) => {
    if (u.includes("period=3a")) return { status: 200, body: daily };
    return { status: 200, body: intraday };
  });
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("hacim TL modülü", () => {
  it("tanım geçerli", () => {
    expect(def.id).toBe("hacim-tl");
    expect(def.scope).toBe("stock");
  });

  it("bugünkü TL, 20 gün ortalaması ve oranı gösterir", async () => {
    api();
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("vol-today")).toHaveTextContent("6.000"); // 6000 TL
    expect(screen.getByTestId("vol-avg")).toHaveTextContent("1.000");
    expect(screen.getByTestId("vol-ratio")).toHaveTextContent("6,00x");
  });

  it("her mum için bir çubuk çizer; yön renkleri doğru", async () => {
    api();
    render(<Comp symbol="THYAO" />);
    const bars = await screen.findAllByTestId("vol-bar");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveClass("up");
    expect(bars[1]).toHaveClass("down");
  });

  it("en yüksek hacimli çubuk en uzun olur", async () => {
    api();
    render(<Comp symbol="THYAO" />);
    const bars = await screen.findAllByTestId("vol-bar");
    const hs = bars.map((b) => Number(b.getAttribute("height")));
    expect(hs[2]).toBeGreaterThan(hs[1]);
    expect(hs[1]).toBeGreaterThan(hs[0]);
  });

  it("fare üstünde TL ve lot ayrıntısı yazar", async () => {
    api();
    render(<Comp symbol="THYAO" />);
    await screen.findAllByTestId("vol-bar");
    fireEvent.mouseMove(screen.getByRole("img", { name: "Hacim TL grafiği" }), { clientX: 5 });
    expect(screen.getByTestId("vol-info")).toHaveTextContent("10:00 · 1.000 TL · 100 lot");
  });

  it("dönem değişince o dönem istenir", async () => {
    const f = api();
    render(<Comp symbol="THYAO" />);
    await screen.findAllByTestId("vol-bar");
    await userEvent.click(screen.getByRole("button", { name: "1A" }));
    await vi.waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("period=1a"))).toBe(true));
  });

  it("geçmiş azsa oran yerine tire gösterir", async () => {
    mockFetch((u) => ({ status: 200, body: u.includes("period=3a") ? mk(daily.candles.slice(0, 4)) : intraday }));
    render(<Comp symbol="NEWIPO" />);
    expect(await screen.findByTestId("vol-ratio")).toHaveTextContent("–");
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findAllByText("Hisse bulunamadı")).not.toHaveLength(0);
  });
});
