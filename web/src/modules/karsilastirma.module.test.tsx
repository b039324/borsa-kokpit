import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./karsilastirma.module";
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

const SERIES: Record<string, number[]> = {
  THYAO: [100, 120, 150], // +50
  USDTRY: [30, 33, 36], // +20
  XU100: [10, 11, 12],
  GOLD: [2000, 1900, 1800],
};

function setup() {
  const f = mockFetch((url) => {
    const sym = /symbol=([^&]+)/.exec(url)![1];
    const period = /period=([^&]+)/.exec(url)![1];
    return { status: 200, body: make(SERIES[sym], sym, period) };
  });
  render(<Comp symbol="THYAO" />);
  return f;
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("karşılaştırma modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("karsilastirma");
    expect(def.scope).toBe("stock");
  });

  it("varsayılan USD/TRY ile iki çizgi ve getirileri gösterir", async () => {
    setup();
    expect(await screen.findByTestId("cmp-stock")).toHaveTextContent("+50,00%");
    expect(screen.getByTestId("cmp-bench")).toHaveTextContent("+20,00%");
    expect(screen.getByTestId("lc-cmp-stock")).toBeInTheDocument();
    expect(screen.getByTestId("lc-cmp-bench")).toBeInTheDocument();
    expect(screen.getByLabelText("Karşılaştırılacak")).toHaveValue("USDTRY");
  });

  it("kıyas seçilince o sembol istenir", async () => {
    const f = setup();
    await screen.findByTestId("cmp-stock");
    await userEvent.selectOptions(screen.getByLabelText("Karşılaştırılacak"), "GOLD");
    expect(await screen.findByTestId("cmp-bench")).toHaveTextContent("-10,00%");
    expect(f.mock.calls.some((c) => String(c[0]).includes("symbol=GOLD"))).toBe(true);
  });

  it("dönem düğmesi değişince yeni dönem istenir", async () => {
    const f = setup();
    await screen.findByTestId("cmp-stock");
    await userEvent.click(screen.getByRole("button", { name: "1 yıl" }));
    await screen.findByTestId("cmp-stock");
    expect(f.mock.calls.some((c) => String(c[0]).includes("period=1y"))).toBe(true);
  });

  it("veri gelmezse mesaj verir", async () => {
    mockFetch(() => ({ status: 500 }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/Veri yok|alınamadı/i)).toBeInTheDocument();
  });
});
