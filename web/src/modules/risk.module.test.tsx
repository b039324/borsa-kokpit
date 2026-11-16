import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./risk.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const mk = (closes: number[]) => ({
  symbol: "THYAO", period: "3a", currency: "TRY", price: closes.at(-1), prevClose: closes.at(-2), gmtoffset: 10800,
  candles: closes.map((c, i) => ({ t: 1_700_000_000 + i * 86400, o: c, h: c, l: c, c, v: 1 })),
});
const flatThenDrop = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90];

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("risk modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("risk");
    expect(def.scope).toBe("stock");
  });

  it("oynaklık, düşüş, en kötü gün ve VaR gösterir", async () => {
    mockFetch(() => ({ status: 200, body: mk(flatThenDrop) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("r-vol")).toHaveTextContent("50,20%");
    expect(screen.getByTestId("r-level")).toHaveTextContent("Yüksek");
    expect(screen.getByTestId("r-maxdd")).toHaveTextContent("-10,00%");
    expect(screen.getByTestId("r-curdd")).toHaveTextContent("-10,00%");
    expect(screen.getByTestId("r-worst")).toHaveTextContent("-10,00%");
    expect(screen.getByTestId("r-var")).toHaveTextContent("-10,00%");
    expect(screen.getByTestId("r-up")).toHaveTextContent("0,00%");
  });

  it("bilgi notu: geçmiş veri, tavsiye değildir", async () => {
    mockFetch(() => ({ status: 200, body: mk(flatThenDrop) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/geçmiş/i)).toHaveTextContent(/tavsiyesi değildir/i);
  });

  it("yeterli veri yoksa mesaj verir", async () => {
    mockFetch(() => ({ status: 200, body: mk([100, 101, 102]) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Risk hesabı için yeterli veri yok.")).toBeInTheDocument();
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });

  it("yükleniyor durumu gösterir", () => {
    mockFetch(() => ({ status: 200, body: mk(flatThenDrop) }));
    render(<Comp symbol="THYAO" />);
    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();
  });
});
