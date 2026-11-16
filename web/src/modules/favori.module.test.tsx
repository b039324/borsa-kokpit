import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./favori.module";
import { FavoritesProvider } from "../favorites";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

function setup(opts: Parameters<typeof apiMock>[0]) {
  const api = apiMock(opts);
  render(
    <SelectionProvider>
      <FavoritesProvider>
        <Comp symbol={null} />
        <Probe />
      </FavoritesProvider>
    </SelectionProvider>,
  );
  return api;
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("favori modülü", () => {
  it("tanım: hisseden bağımsız (global) modül", () => {
    expect(def.id).toBe("favori");
    expect(def.scope).toBe("global");
  });

  it("favori yoksa yönlendirici mesaj gösterir", async () => {
    setup({ favorites: [] });
    expect(await screen.findByText(/Henüz favori yok/)).toBeInTheDocument();
  });

  it("favorileri fiyat ve yüzde değişimle listeler", async () => {
    setup({ favorites: ["THYAO", "GARAN"], quotes: { THYAO: { price: 110, prevClose: 100 }, GARAN: { price: 90, prevClose: 100 } } });
    expect(await screen.findByText("110,00")).toBeInTheDocument();
    expect(screen.getByText("+10,00%")).toHaveClass("up");
    expect(screen.getByText("-10,00%")).toHaveClass("down");
  });

  it("fiyatı alınamayan hisse 'yok' görünür, diğerleri etkilenmez", async () => {
    setup({ favorites: ["THYAO", "ZZZZ"], quotes: { THYAO: { price: 110, prevClose: 100 } } });
    expect(await screen.findByText("110,00")).toBeInTheDocument();
    expect(screen.getByText("yok")).toBeInTheDocument();
  });

  it("hisse adına tıklayınca o hisse seçilir", async () => {
    setup({ favorites: ["THYAO"], quotes: { THYAO: { price: 1, prevClose: 1 } } });
    await userEvent.click(await screen.findByRole("button", { name: "THYAO" }));
    expect(screen.getByTestId("sel")).toHaveTextContent("THYAO");
  });

  it("★ ile favoriden çıkarır ve sunucuya kaydeder", async () => {
    const { favPuts } = setup({ favorites: ["THYAO"], quotes: { THYAO: { price: 1, prevClose: 1 } } });
    await userEvent.click(await screen.findByRole("button", { name: "THYAO favoriden çıkar" }));
    expect(await screen.findByText(/Henüz favori yok/)).toBeInTheDocument();
    await waitFor(() => expect(favPuts.at(-1)).toEqual([]));
  });
});
