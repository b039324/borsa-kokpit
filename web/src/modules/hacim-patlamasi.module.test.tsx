import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./hacim-patlamasi.module";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

const stats = {
  THYAO: { price: 110, prevClose: 100, volume: 5_000_000, avgVolume: 1_000_000 }, // 5x, +10%
  GARAN: { price: 95, prevClose: 100, volume: 3_000_000, avgVolume: 1_000_000 }, // 3x, -5%
  AKBNK: { price: 100, prevClose: 100, volume: 1_500_000, avgVolume: 1_000_000 }, // 1,5x → eşik altı
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
const syms = () => screen.getAllByTestId("hp-sym").map((e) => e.textContent);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("hacim patlaması modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("hacim-patlamasi");
    expect(def.scope).toBe("global");
  });

  it("ortalamasının en az 2 katına çıkanları oran sırasıyla listeler", async () => {
    setup();
    await screen.findAllByTestId("hp-sym");
    expect(syms()).toEqual(["THYAO", "GARAN"]);
    expect(screen.getAllByTestId("hp-ratio")[0]).toHaveTextContent("5,0×");
    expect(screen.getAllByTestId("hp-pct")[0]).toHaveTextContent("+10,00%");
    expect(screen.getAllByTestId("hp-pct")[1]).toHaveTextContent("-5,00%");
  });

  it("hacmi lot olarak kısaltarak gösterir", async () => {
    setup();
    await screen.findAllByTestId("hp-sym");
    expect(screen.getAllByTestId("hp-vol")[0]).toHaveTextContent("5,00 mn");
  });

  it("satıra tıklayınca hisse seçilir", async () => {
    setup();
    await userEvent.click((await screen.findAllByTestId("hp-sym"))[0]);
    expect(screen.getByTestId("sel")).toHaveTextContent("THYAO");
  });

  it("hacim patlaması yoksa bunu söyler", async () => {
    setup({ AKBNK: stats.AKBNK });
    expect(await screen.findByText(/2 katını aşan hisse yok/)).toBeInTheDocument();
  });

  it("veri gelmezse mesaj verir", async () => {
    setup({});
    expect(await screen.findByText("Veri yok.")).toBeInTheDocument();
  });

  it("seans içi uyarı notunu gösterir", async () => {
    setup();
    await screen.findAllByTestId("hp-sym");
    expect(screen.getByText(/seans ilerledikçe/i)).toBeInTheDocument();
  });
});
