import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./portfoy-dagilim.module";
import { PortfolioProvider } from "../portfolio/PortfolioProvider";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;
const quotes = { AAA: { price: 12, prevClose: 11 }, BBB: { price: 18, prevClose: 19 } };
const seed = [
  { symbol: "BBB", qty: 50, cost: 20 }, // değer 900
  { symbol: "AAA", qty: 100, cost: 10 }, // değer 1200
];
const setup = (opts: Parameters<typeof apiMock>[0] = {}) => {
  apiMock({ portfolio: seed, quotes, ...opts });
  render(
    <SelectionProvider>
      <PortfolioProvider>
        <Comp symbol={null} />
      </PortfolioProvider>
      <Probe />
    </SelectionProvider>,
  );
};

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("portfoy-dagilim modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("portfoy-dagilim");
    expect(def.scope).toBe("global");
  });

  it("ağırlığa göre büyükten küçüğe sıralar ve yüzdeleri yazar", async () => {
    setup();
    await screen.findAllByTestId("pd-sym");
    expect(screen.getAllByTestId("pd-sym").map((e) => e.textContent)).toEqual(["AAA", "BBB"]);
    expect(screen.getAllByTestId("pd-pct").map((e) => e.textContent)).toEqual(["57,14%", "42,86%"]);
  });

  it("çubuk genişliği ağırlıkla orantılıdır", async () => {
    setup();
    const bars = await screen.findAllByTestId("pd-bar");
    expect(bars[0].style.width).toBe("57.14%");
    expect(bars[1].style.width).toBe("42.86%");
  });

  it("fiyatı olmayan pozisyonlar dağılıma girmez, altta listelenir", async () => {
    setup({ quotes: { AAA: quotes.AAA } });
    await screen.findAllByTestId("pd-sym");
    expect(screen.getAllByTestId("pd-pct")[0]).toHaveTextContent("100,00%");
    expect(screen.getByText(/Fiyatı yok: BBB/)).toBeInTheDocument();
  });

  it("satıra tıklayınca hisse seçilir", async () => {
    setup();
    await userEvent.click((await screen.findAllByTestId("pd-sym"))[0]);
    expect(screen.getByTestId("sel")).toHaveTextContent("AAA");
  });

  it("pozisyon yoksa açıklama gösterir", async () => {
    setup({ portfolio: [] });
    expect(await screen.findByText(/Henüz pozisyon yok/)).toBeInTheDocument();
  });
});
