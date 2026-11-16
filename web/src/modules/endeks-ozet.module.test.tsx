import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./endeks-ozet.module";
import { apiMock, mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const items = [
  { key: "XU100", label: "BIST 100", decimals: 2, price: 11000, prevClose: 10000 },
  { key: "USDTRY", label: "USD/TRY", decimals: 4, price: 42.1234, prevClose: 42.5 },
  { key: "GOLD", label: "Altın (ons, USD)", decimals: 2, price: null, prevClose: null },
];

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("endeks / piyasa özeti modülü", () => {
  it("tanım: hisseden bağımsız (global)", () => {
    expect(def.id).toBe("endeks-ozet");
    expect(def.scope).toBe("global");
  });

  it("her kalemi etiket, fiyat ve yüzde değişimle gösterir", async () => {
    apiMock({ market: items });
    render(<Comp symbol={null} />);
    const bist = await screen.findByTestId("mkt-XU100");
    expect(bist).toHaveTextContent("BIST 100");
    expect(bist).toHaveTextContent("11.000,00");
    expect(bist.querySelector(".price-chg")).toHaveTextContent("+10,00%");
    expect(bist.querySelector(".price-chg")).toHaveClass("up");
  });

  it("kura özgü ondalık sayısını (4) kullanır, düşüş kırmızı", async () => {
    apiMock({ market: items });
    render(<Comp symbol={null} />);
    const fx = await screen.findByTestId("mkt-USDTRY");
    expect(fx).toHaveTextContent("42,1234");
    expect(fx.querySelector(".price-chg")).toHaveClass("down");
  });

  it("verisi gelmeyen kalem tire gösterir, diğerleri etkilenmez", async () => {
    apiMock({ market: items });
    render(<Comp symbol={null} />);
    const gold = await screen.findByTestId("mkt-GOLD");
    expect(gold).toHaveTextContent("–");
    expect(screen.getByTestId("mkt-XU100")).toHaveTextContent("11.000,00");
  });

  it("sunucu hatasında mesaj gösterir", async () => {
    mockFetch(() => ({ status: 502 }));
    render(<Comp symbol={null} />);
    expect(await screen.findByText("Piyasa verisi alınamadı")).toBeInTheDocument();
  });

  it("yükleniyor durumu gösterir", () => {
    apiMock({ market: items });
    render(<Comp symbol={null} />);
    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();
  });
});
