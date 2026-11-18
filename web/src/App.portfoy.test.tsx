import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { apiMock, TOKEN_KEY } from "./test/helpers";

afterEach(() => vi.unstubAllGlobals());

const seed = [{ symbol: "AAA", qty: 100, cost: 10 }];
const quotes = { AAA: { price: 12, prevClose: 11 } };

// Portföy verisi sayfa/modül düzeninden bağımsız, sunucuda durur: sekme silinse ya da modül
// kapatılıp açılsa da pozisyonlar geri gelir.
describe("portföy sayfası", () => {
  it("'+' menüsünden Portföy şablonu eklenir, modüller pozisyonları gösterir", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    apiMock({ portfolio: seed, quotes });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Yeni sayfa" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /^Portföy/ }));
    expect(await screen.findByRole("tab", { name: /Portföy/, selected: true })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pp-value")).toHaveTextContent("1.200,00"));
    expect(screen.getByTestId("po-value")).toHaveTextContent("1.200,00");
  });

  it("Portföy sekmesi silinip şablon yeniden eklenince pozisyonlar yerinde durur", async () => {
    localStorage.setItem(TOKEN_KEY, "tok");
    const m = apiMock({ portfolio: seed, quotes });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    const addPortfolio = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Yeni sayfa" }));
      await userEvent.click(screen.getByRole("menuitem", { name: /^Portföy/ }));
    };
    await addPortfolio();
    await waitFor(() => expect(screen.getByTestId("pp-value")).toHaveTextContent("1.200,00"));

    await userEvent.click(screen.getByRole("button", { name: "Portföy sayfasını sil" }));
    expect(screen.queryByTestId("pp-value")).toBeNull();

    await addPortfolio();
    await waitFor(() => expect(screen.getByTestId("pp-value")).toHaveTextContent("1.200,00"));
    // Silme ve yeniden ekleme portföyü sunucuya hiç yazmadı (veri değişmedi).
    expect(m.portfolioPuts).toHaveLength(0);
  });
});
