import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./goreli-guc.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const DAY = 86400;
const T0 = 1_700_000_000;
const make = (closes: number[], symbol: string, period: string) => ({
  symbol,
  period,
  currency: "TRY",
  price: closes.at(-1),
  prevClose: closes.at(-2),
  gmtoffset: 10800,
  candles: closes.map((c, i) => ({ t: T0 + i * DAY, o: c, h: c, l: c, c, v: 1 })),
});

// hisse 100 → 150 (+%50), endeks 100 → 120 (+%20)
const STOCK = [100, 110, 130, 150];
const INDEX = [100, 105, 110, 120];

function setup(stock = STOCK, index = INDEX) {
  const f = mockFetch((url) => {
    const sym = /symbol=([^&]+)/.exec(url)![1];
    const period = /period=([^&]+)/.exec(url)![1];
    return { status: 200, body: make(sym === "XU100" ? index : stock, sym, period) };
  });
  render(<Comp symbol="THYAO" />);
  return f;
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("göreli güç modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("goreli-guc");
    expect(def.scope).toBe("stock");
  });

  it("hisse ve BIST 100 getirisini, farkı ve yorumu gösterir", async () => {
    setup();
    expect(await screen.findByTestId("rs-stock")).toHaveTextContent("+50,00%");
    expect(screen.getByTestId("rs-bench")).toHaveTextContent("+20,00%");
    expect(screen.getByTestId("rs-diff")).toHaveTextContent("+30,00 puan");
    expect(screen.getByTestId("rs-verdict")).toHaveTextContent("Endeksi geçiyor");
    expect(screen.getByTestId("lc-rs")).toBeInTheDocument();
  });

  it("hisse endeksin gerisindeyse bunu söyler", async () => {
    setup([100, 95, 90, 85], INDEX);
    expect(await screen.findByTestId("rs-verdict")).toHaveTextContent("Endeksin gerisinde");
    expect(screen.getByTestId("rs-diff")).toHaveTextContent("-35,00 puan");
  });

  it("varsayılan 6 ay; dönem düğmesi yeni dönem ister", async () => {
    const f = setup();
    await screen.findByTestId("rs-stock");
    expect(screen.getByRole("button", { name: "6 ay" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "1 yıl" }));
    await screen.findByTestId("rs-stock");
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("symbol=XU100") && u.includes("period=1y"))).toBe(true);
    expect(urls.some((u) => u.includes("symbol=THYAO") && u.includes("period=1y"))).toBe(true);
  });

  it("ortak tarih yoksa mesaj verir", async () => {
    mockFetch((url) => {
      const sym = /symbol=([^&]+)/.exec(url)![1];
      const c = make([100, 101], sym, "6a");
      if (sym === "XU100") c.candles = c.candles.map((x) => ({ ...x, t: x.t + 400 * DAY }));
      return { status: 200, body: c };
    });
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/Karşılaştırılacak ortak veri yok/)).toBeInTheDocument();
  });

  it("veri gelmezse mesaj verir", async () => {
    mockFetch(() => ({ status: 500 }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/Veri yok|alınamadı/i)).toBeInTheDocument();
  });
});
