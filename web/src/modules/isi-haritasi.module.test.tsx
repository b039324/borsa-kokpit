import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./isi-haritasi.module";
import { SelectionProvider, useSelection } from "../selection";
import { SYMBOL_LISTS } from "../data/symbols";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

// BIST 100'ün hepsi için fiyat üret; THYAO büyük hacimli yükselen, GARAN düşen, ASELS hacimsiz
function allQuotes(over: Record<string, any> = {}) {
  const q: Record<string, any> = {};
  SYMBOL_LISTS.BIST100.forEach((s) => (q[s] = { price: 10, prevClose: 10, volume: 1000 }));
  q.THYAO = { price: 110, prevClose: 100, volume: 1_000_000 };
  q.GARAN = { price: 90, prevClose: 100, volume: 500_000 };
  return { ...q, ...over };
}

function setup(quotes: Record<string, any>) {
  const api = apiMock({ quotes });
  render(
    <SelectionProvider>
      <Comp symbol={null} />
      <Probe />
    </SelectionProvider>,
  );
  return api;
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("ısı haritası modülü", () => {
  it("tanım: hisseden bağımsız (global)", () => {
    expect(def.id).toBe("isi-haritasi");
    expect(def.scope).toBe("global");
  });

  it("varsayılan sekme BIST 30: 30 kutu çizer", async () => {
    setup(allQuotes());
    const cells = await screen.findAllByTestId("heat-cell");
    expect(cells).toHaveLength(30);
    expect(screen.getByRole("tab", { name: "BIST 30" })).toHaveAttribute("aria-selected", "true");
  });

  it("BIST 100 sekmesine geçince 100 kutu çizer", async () => {
    setup(allQuotes());
    await screen.findAllByTestId("heat-cell");
    await userEvent.click(screen.getByRole("tab", { name: "BIST 100" }));
    await vi.waitFor(() => expect(screen.getAllByTestId("heat-cell")).toHaveLength(100));
  });

  it("büyük TL hacimli hisse daha büyük kutu alır", async () => {
    setup(allQuotes());
    await screen.findAllByTestId("heat-cell");
    const area = (name: string) => {
      const el = screen.getByRole("button", { name: new RegExp(`^${name} `) });
      return parseFloat(el.style.width) * parseFloat(el.style.height);
    };
    // THYAO: 110×1.000.000, GARAN: 90×500.000, sıradan hisse: 10×1000
    expect(area("THYAO")).toBeGreaterThan(area("GARAN"));
    expect(area("GARAN")).toBeGreaterThan(area("AKBNK"));
  });

  it("renk günlük değişimi yansıtır: yükselen yeşilimsi, düşen kırmızımsı", async () => {
    setup(allQuotes());
    await screen.findAllByTestId("heat-cell");
    const thy = screen.getByRole("button", { name: /^THYAO / });
    const gar = screen.getByRole("button", { name: /^GARAN / });
    expect(thy.style.background).toBe("rgb(31, 157, 85)"); // +10% → tam yeşil
    expect(gar.style.background).toBe("rgb(214, 69, 69)"); // −10% → tam kırmızı
  });

  it("hacmi olmayan hisse haritaya girmez, altta sayısı yazılır", async () => {
    setup(allQuotes({ ASELS: { price: 10, prevClose: 10, volume: 0 }, SISE: { price: 10, prevClose: 10 } }));
    await screen.findAllByTestId("heat-cell");
    expect(screen.getAllByTestId("heat-cell")).toHaveLength(28); // BIST 30 − 2
    expect(screen.queryByRole("button", { name: /^ASELS / })).not.toBeInTheDocument();
    expect(screen.getByText(/2 hissede veri yok/)).toBeInTheDocument();
  });

  it("kutuya tıklayınca hisse seçilir", async () => {
    setup(allQuotes());
    await screen.findAllByTestId("heat-cell");
    await userEvent.click(screen.getByRole("button", { name: /^THYAO / }));
    expect(screen.getByTestId("sel")).toHaveTextContent("THYAO");
    expect(screen.getByRole("button", { name: /^THYAO / })).toHaveAttribute("aria-pressed", "true");
  });

  it("tooltip fiyat, değişim ve TL hacmi içerir", async () => {
    setup(allQuotes());
    await screen.findAllByTestId("heat-cell");
    const title = screen.getByRole("button", { name: /^THYAO / }).getAttribute("title")!;
    expect(title).toContain("110,00");
    expect(title).toContain("+10,00%");
    expect(title).toContain("110,00 mn TL"); // 110 × 1.000.000
  });

  it("hiç hacim yoksa açıklayıcı mesaj gösterir", async () => {
    const q: Record<string, any> = {};
    SYMBOL_LISTS.BIST100.forEach((s) => (q[s] = { price: 10, prevClose: 10 }));
    setup(q);
    expect(await screen.findByText(/Hacim verisi yok/)).toBeInTheDocument();
  });
});
