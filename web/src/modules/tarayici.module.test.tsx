import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./tarayici.module";
import { SelectionProvider, useSelection } from "../selection";
import { SYMBOL_LISTS } from "../data/symbols";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

const only100 = SYMBOL_LISTS.BIST100.find((s) => !SYMBOL_LISTS.BIST30.includes(s))!;
const [S1, S2] = SYMBOL_LISTS.BIST30;

const stats = {
  [S1]: { price: 104, prevClose: 100, rsi: 25, sma50: 100, sma20: 101, volume: 3000, avgVolume: 1000 }, // +4%
  [S2]: { price: 98, prevClose: 100, rsi: 55, sma50: 100, sma20: 99, volume: 900, avgVolume: 1000 }, // -2%
  [only100]: { price: 120, prevClose: 100, rsi: 28, sma50: 100, sma20: 110 }, // +20%
};

function setup(s: Record<string, any> = stats) {
  apiMock({ stats: s });
  render(
    <SelectionProvider>
      <Comp symbol={null} />
      <Probe />
    </SelectionProvider>,
  );
}
const syms = () => screen.queryAllByTestId("tr-sym").map((e) => e.textContent);
const pick = (label: string, value: string) => userEvent.selectOptions(screen.getByLabelText(label), value);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("tarayıcı modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("tarayici");
    expect(def.scope).toBe("global");
  });

  it("filtresiz tüm hisseleri günlük değişime göre azalan listeler", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    expect(syms()).toEqual([only100, S1, S2]);
    expect(screen.getAllByTestId("tr-pct")[0]).toHaveTextContent("+20,00%");
    expect(screen.getAllByTestId("tr-rsi")[1]).toHaveTextContent("25");
    expect(screen.getAllByTestId("tr-ratio")[1]).toHaveTextContent("3,0×");
  });

  it("RSI filtresi uygulanır; sayaç eşleşen / taranan gösterir", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    await pick("RSI (14)", "low");
    expect(syms()).toEqual([only100, S1]);
    expect(screen.getByTestId("tr-count")).toHaveTextContent("2 / 3");
  });

  it("birden çok filtre birlikte (VE) çalışır", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    await pick("RSI (14)", "low");
    await pick("Hacim", "spike");
    expect(syms()).toEqual([S1]);
  });

  it("liste BIST 30'a çevrilince yalnız BIST 30 hisseleri kalır", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    await pick("Liste", "BIST30");
    await screen.findAllByTestId("tr-sym");
    expect(syms()).not.toContain(only100);
    expect(syms()).toContain(S1);
  });

  it("'Temizle' tüm filtreleri sıfırlar", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    await pick("RSI (14)", "low");
    await userEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }));
    expect(syms()).toHaveLength(3);
    expect(screen.getByLabelText("RSI (14)")).toHaveValue("");
  });

  it("eşleşen yoksa mesaj verir", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    await pick("RSI (14)", "high");
    expect(screen.getByText("Eşleşen hisse yok.")).toBeInTheDocument();
    expect(screen.getByTestId("tr-count")).toHaveTextContent("0 / 3");
  });

  it("satıra tıklayınca hisse seçilir", async () => {
    setup();
    await userEvent.click((await screen.findAllByTestId("tr-sym"))[0]);
    expect(screen.getByTestId("sel")).toHaveTextContent(only100);
  });

  it("her filtre grubu 'Fark etmez' seçeneğiyle gelir", async () => {
    setup();
    await screen.findAllByTestId("tr-sym");
    const rsi = screen.getByLabelText("RSI (14)");
    expect(within(rsi).getAllByRole("option")[0]).toHaveTextContent("Fark etmez");
  });

  it("veri gelmezse mesaj verir; tavsiye değildir notu görünür", async () => {
    setup({});
    expect(await screen.findByText("Veri yok.")).toBeInTheDocument();
    expect(screen.getByText(/tavsiyesi değildir/i)).toBeInTheDocument();
  });
});
