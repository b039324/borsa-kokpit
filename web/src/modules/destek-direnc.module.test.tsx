import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./destek-direnc.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const mk = (i: number, h: number, l: number, c: number) => ({ t: 1_700_000_000 + i * 86400, o: c, h, l, c, v: 1000 });
const body = (candles: any[], price = 11) => ({
  symbol: "THYAO", period: "3a", currency: "TRY", price, prevClose: 10, gmtoffset: 10800, candles,
});

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("destek/direnç/pivot modülü", () => {
  it("modül tanımı geçerli", () => {
    expect(def.id).toBe("destek-direnc");
    expect(def.scope).toBe("stock");
  });

  it("önceki günün H/L/K'sından pivot seviyelerini gösterir", async () => {
    mockFetch(() => ({ status: 200, body: body([mk(0, 11, 9, 10), mk(1, 12, 8, 11)]) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("lvl-p")).toHaveTextContent("10,33");
    expect(screen.getByTestId("lvl-r1")).toHaveTextContent("12,67");
    expect(screen.getByTestId("lvl-s1")).toHaveTextContent("8,67");
    expect(screen.getByTestId("lvl-r2")).toHaveTextContent("14,33");
    expect(screen.getByTestId("lvl-s3")).toHaveTextContent("4,67");
  });

  it("yakın tepe/dipten destek ve direnç gösterir", async () => {
    const highs = [10, 11, 12, 15, 12, 11, 10, 9, 10, 11];
    const lows = [8, 9, 10, 13, 10, 9, 8, 7, 8, 9];
    const candles = highs.map((h, i) => mk(i, h, lows[i], (h + lows[i]) / 2));
    mockFetch(() => ({ status: 200, body: body(candles, 10) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("swing-support")).toHaveTextContent("7,00");
    expect(screen.getByTestId("swing-resistance")).toHaveTextContent("15,00");
  });

  it("bulunamazsa tire gösterir ve bilgi notunu içerir", async () => {
    mockFetch(() => ({ status: 200, body: body([mk(0, 11, 9, 10), mk(1, 12, 8, 11)]) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("swing-support")).toHaveTextContent("–");
    expect(screen.getByText(/bilgi amaçlıdır/i)).toBeInTheDocument();
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });
});
