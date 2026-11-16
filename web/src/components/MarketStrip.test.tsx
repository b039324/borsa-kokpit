import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketStrip } from "./MarketStrip";
import { apiMock, mockFetch, TOKEN_KEY } from "../test/helpers";

const items = [
  { key: "XU100", label: "BIST 100", decimals: 2, price: 11000, prevClose: 10000 },
  { key: "USDTRY", label: "USD/TRY", decimals: 4, price: 42.1234, prevClose: 42.5 },
  { key: "GOLD", label: "Altın", decimals: 2, price: null, prevClose: null },
];

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("üst çubuk piyasa şeridi", () => {
  it("kalemleri tek satırda etiket, fiyat ve yüzdeyle gösterir", async () => {
    apiMock({ market: items });
    render(<MarketStrip />);
    const bist = await screen.findByTestId("strip-XU100");
    expect(bist).toHaveTextContent("BIST 100");
    expect(bist).toHaveTextContent("11.000,00");
    expect(bist.querySelector(".price-chg")).toHaveTextContent("+10,00%");
    expect(bist.querySelector(".price-chg")).toHaveClass("up");
    expect(screen.getByTestId("strip-USDTRY")).toHaveTextContent("42,1234");
    expect(screen.getByTestId("strip-USDTRY").querySelector(".price-chg")).toHaveClass("down");
  });

  it("verisi olmayan kalem tire gösterir", async () => {
    apiMock({ market: items });
    render(<MarketStrip />);
    expect(await screen.findByTestId("strip-GOLD")).toHaveTextContent("–");
  });

  it("hata olursa şerit boş kalır, çökmez", async () => {
    mockFetch(() => ({ status: 500 }));
    const { container } = render(<MarketStrip />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelectorAll("[data-testid^='strip-']").length).toBe(0);
  });

  it("Banka ve S&P 500 şeritte yok; Brent var", async () => {
    apiMock({
      market: [
        { key: "XU100", label: "BIST 100", decimals: 2, price: 1, prevClose: 1 },
        { key: "XBANK", label: "BIST Banka", decimals: 2, price: 1, prevClose: 1 },
        { key: "BRENT", label: "Brent", decimals: 2, price: 80, prevClose: 79 },
        { key: "SP500", label: "S&P 500", decimals: 2, price: 1, prevClose: 1 },
      ],
    });
    render(<MarketStrip />);
    await screen.findByTestId("strip-BRENT");
    expect(screen.getByTestId("strip-XU100")).toBeInTheDocument();
    expect(screen.queryByTestId("strip-XBANK")).not.toBeInTheDocument();
    expect(screen.queryByTestId("strip-SP500")).not.toBeInTheDocument();
  });
});
