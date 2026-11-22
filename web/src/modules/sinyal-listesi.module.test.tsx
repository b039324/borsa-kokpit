import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./sinyal-listesi.module";
import { SelectionProvider, useSelection } from "../selection";
import { SYMBOL_LISTS } from "../data/symbols";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

const only100 = SYMBOL_LISTS.BIST100.find((s) => !SYMBOL_LISTS.BIST30.includes(s))!;
const [S1, S2, S3] = SYMBOL_LISTS.BIST30;

const stats = {
  [S1]: { price: 110, prevClose: 100, rsi: 25, sma20: 105, sma50: 100 }, // AL (+3)
  [S2]: { price: 90, prevClose: 100, rsi: 75, sma20: 95, sma50: 100 }, // SAT (-3)
  [S3]: { price: 100, prevClose: 100, rsi: 50, sma20: 99, sma50: 100 }, // TUT (0 / 1)
  [only100]: { price: 120, prevClose: 100, rsi: 50, sma20: 110, sma50: 100 }, // AL (+2)
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
const syms = () => screen.queryAllByTestId("sl-sym").map((e) => e.textContent);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("sinyal listesi modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("sinyal-listesi");
    expect(def.scope).toBe("global");
  });

  it("BIST 100'ü tarar; AL önce, sonra TUT, en altta SAT sıralar", async () => {
    setup();
    await screen.findAllByTestId("sl-sym");
    const order = syms();
    expect(order[0]).toBe(S1); // skor +3
    expect(order[1]).toBe(only100); // skor +2
    expect(order[order.length - 1]).toBe(S2); // skor -3
  });

  it("her satırda karar ve skor görünür", async () => {
    setup();
    await screen.findAllByTestId("sl-sym");
    expect(screen.getAllByTestId("sl-verdict")[0]).toHaveTextContent("AL");
    expect(screen.getAllByTestId("sl-score")[0]).toHaveTextContent("+3");
  });

  it("özet satırı AL / TUT / SAT sayılarını gösterir", async () => {
    setup();
    await screen.findAllByTestId("sl-sym");
    expect(screen.getByTestId("sl-summary")).toHaveTextContent("AL 2");
    expect(screen.getByTestId("sl-summary")).toHaveTextContent("SAT 1");
    expect(screen.getByTestId("sl-summary")).toHaveTextContent("TUT 1");
  });

  it("karar filtresi yalnız seçilen kararı listeler", async () => {
    setup();
    await screen.findAllByTestId("sl-sym");
    await userEvent.click(screen.getByRole("button", { name: "SAT" }));
    expect(syms()).toEqual([S2]);
    await userEvent.click(screen.getByRole("button", { name: "Hepsi" }));
    expect(syms().length).toBe(4);
  });

  it("liste seçimi BIST 30'a çevrilince yalnız o hisseleri isteyip gösterir", async () => {
    setup();
    await screen.findAllByTestId("sl-sym");
    await userEvent.selectOptions(screen.getByLabelText("Liste"), "BIST30");
    expect(syms()).not.toContain(only100);
    expect(syms()).toContain(S1);
  });

  it("satıra tıklayınca hisse seçilir", async () => {
    setup();
    await screen.findAllByTestId("sl-sym");
    await userEvent.click(screen.getAllByTestId("sl-sym")[0]);
    expect(screen.getByTestId("sel")).toHaveTextContent(S1);
  });

  it("yeterli verisi olmayan hisse listede 'Yetersiz' görünür, çökmez", async () => {
    setup({ [S1]: { price: 100, prevClose: 100 } });
    await screen.findAllByTestId("sl-sym");
    expect(screen.getAllByTestId("sl-verdict")[0]).toHaveTextContent("YETERSİZ");
  });

  it("veri gelmezse hata mesajı gösterir", async () => {
    setup({});
    expect(await screen.findByText(/veri yok|alınamadı/i)).toBeInTheDocument();
  });
});
