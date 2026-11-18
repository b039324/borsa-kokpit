import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import def from "./portfoy-ozet.module";
import { PortfolioProvider } from "../portfolio/PortfolioProvider";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const quotes = { AAA: { price: 12, prevClose: 11 }, BBB: { price: 18, prevClose: 19 } };
const seed = [
  { symbol: "AAA", qty: 100, cost: 10 },
  { symbol: "BBB", qty: 50, cost: 20 },
];
const setup = (opts: Parameters<typeof apiMock>[0] = {}) => {
  apiMock({ portfolio: seed, quotes, ...opts });
  render(
    <PortfolioProvider>
      <Comp symbol={null} />
    </PortfolioProvider>,
  );
};

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("portfoy-ozet modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("portfoy-ozet");
    expect(def.scope).toBe("global");
  });

  it("toplam değer, maliyet, kâr/zarar ve günlük değişimi gösterir", async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId("po-value")).toHaveTextContent("2.100,00"));
    expect(screen.getByTestId("po-cost")).toHaveTextContent("2.000,00");
    expect(screen.getByTestId("po-pl")).toHaveTextContent("+100,00");
    expect(screen.getByTestId("po-pl")).toHaveTextContent("+5,00%");
    expect(screen.getByTestId("po-day")).toHaveTextContent("+50,00");
    expect(screen.getByTestId("po-day")).toHaveTextContent("+2,44%");
  });

  it("zarardaki portföy eksi işaretli ve 'down' renkli", async () => {
    setup({ quotes: { AAA: { price: 8, prevClose: 8 }, BBB: { price: 10, prevClose: 10 } } });
    await waitFor(() => expect(screen.getByTestId("po-pl")).toHaveTextContent("-700,00"));
    const pl = screen.getByTestId("po-pl");
    expect(pl.className).toContain("down");
  });

  it("bazı pozisyonların fiyatı yoksa sayacı gösterir", async () => {
    setup({ quotes: { AAA: quotes.AAA } });
    expect(await screen.findByText(/1 \/ 2 pozisyonun fiyatı var/)).toBeInTheDocument();
  });

  it("fiyatlar gelmeden toplam '–' gösterir (0 TL gibi yanıltıcı değer yok)", async () => {
    setup({ quotes: {} });
    expect(await screen.findByTestId("po-value")).toHaveTextContent("–");
    expect(screen.getByTestId("po-pl")).toHaveTextContent("–");
  });

  it("pozisyon yoksa açıklama gösterir", async () => {
    setup({ portfolio: [] });
    expect(await screen.findByText(/Henüz pozisyon yok/)).toBeInTheDocument();
  });

  it("yükleme hatasında mesaj verir", async () => {
    setup({ portfolioGetStatus: 500 });
    expect(await screen.findByText(/Portföy yüklenemedi/)).toBeInTheDocument();
  });
});
