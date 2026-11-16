import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./sinyal.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const mk = (closes: number[]) => ({
  symbol: "X", period: "3a", currency: "TRY", price: closes.at(-1), prevClose: closes.at(-2), gmtoffset: 10800,
  candles: closes.map((c, i) => ({ t: 1_700_000_000 + i * 86400, o: c, h: c, l: c, c, v: 1 })),
});
const accelUp = Array.from({ length: 80 }, (_, i) => 100 + i * i * 0.05);
const accelDown = Array.from({ length: 80 }, (_, i) => 300 - i * i * 0.05);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("sinyal modülü", () => {
  it("tanım geçerli", () => {
    expect(def.id).toBe("sinyal");
    expect(def.scope).toBe("stock");
  });

  it("AL kararını yeşil gösterir, skor ve dört gerekçeyi listeler", async () => {
    mockFetch(() => ({ status: 200, body: mk(accelUp) }));
    render(<Comp symbol="THYAO" />);
    const v = await screen.findByTestId("verdict");
    expect(v).toHaveTextContent("AL");
    expect(v).toHaveClass("up");
    expect(screen.getByText(/Skor \+2 \/ 4 gösterge/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("SAT kararını kırmızı gösterir", async () => {
    mockFetch(() => ({ status: 200, body: mk(accelDown) }));
    render(<Comp symbol="THYAO" />);
    const v = await screen.findByTestId("verdict");
    expect(v).toHaveTextContent("SAT");
    expect(v).toHaveClass("down");
  });

  it("veri azsa YETERSİZ der ve mum sayısını yazar", async () => {
    mockFetch(() => ({ status: 200, body: mk(accelUp.slice(0, 10)) }));
    render(<Comp symbol="NEWIPO" />);
    expect(await screen.findByTestId("verdict")).toHaveTextContent("YETERSİZ");
    expect(screen.getByText(/yeterli geçmiş veri yok \(10 mum\)/)).toBeInTheDocument();
  });

  it("tavsiye değildir uyarısı her zaman görünür", async () => {
    mockFetch(() => ({ status: 200, body: mk(accelUp) }));
    render(<Comp symbol="THYAO" />);
    await screen.findByTestId("verdict");
    expect(screen.getByText(/yatırım tavsiyesi değildir/)).toBeInTheDocument();
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });
});
