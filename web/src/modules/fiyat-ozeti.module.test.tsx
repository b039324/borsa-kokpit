import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./fiyat-ozeti.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const body = (over: any = {}) => ({
  symbol: "THYAO", period: "1g", currency: "TRY", price: 110, prevClose: 100, gmtoffset: 10800,
  candles: [
    { t: 1_700_000_000, o: 100, h: 112, l: 99, c: 105, v: 1_000_000 },
    { t: 1_700_000_300, o: 105, h: 111, l: 101, c: 110, v: 2_000_000 },
  ],
  ...over,
});

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("fiyat özeti modülü", () => {
  it("modül tanımı geçerli", () => {
    expect(def.id).toBe("fiyat-ozeti");
    expect(def.scope).toBe("stock");
  });

  it("fiyat, değişim, gün aralığı ve hacmi gösterir", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("110,00")).toBeInTheDocument();
    expect(screen.getByText("+10,00 (+10,00%)")).toHaveClass("up");
    expect(screen.getByText("112,00")).toBeInTheDocument(); // gün en yüksek
    expect(screen.getByText("99,00")).toBeInTheDocument(); // gün en düşük
    expect(screen.getByText("3,00 mn")).toBeInTheDocument(); // 3.000.000 lot
    expect(screen.getByText("325,00 mn")).toBeInTheDocument(); // 105×1M + 110×2M TL
  });

  it("düşüşte kırmızı sınıfı ve eksi işareti", async () => {
    mockFetch(() => ({ status: 200, body: body({ price: 90 }) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("-10,00 (-10,00%)")).toHaveClass("down");
  });

  it("önceki kapanış yoksa değişim gösterilmez", async () => {
    mockFetch(() => ({ status: 200, body: body({ prevClose: null }) }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("110,00");
    expect(screen.queryByText(/%\)/)).not.toBeInTheDocument();
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });

  it("yükleniyor durumu gösterir", () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();
  });
});
