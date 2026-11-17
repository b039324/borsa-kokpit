import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./en-cok-hareket.module";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

const quotes = {
  THYAO: { price: 110, prevClose: 100, volume: 1000 }, // +10, 110.000 TL
  ASELS: { price: 103, prevClose: 100, volume: 100 }, // +3
  GARAN: { price: 90, prevClose: 100, volume: 500 }, // -10
  AKBNK: { price: 97, prevClose: 100, volume: 90_000 }, // -3, 8.730.000 TL
};

function setup() {
  apiMock({ quotes });
  render(
    <SelectionProvider>
      <Comp symbol={null} />
      <Probe />
    </SelectionProvider>,
  );
}
const syms = () => screen.getAllByTestId("mv-sym").map((e) => e.textContent);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("en çok yükselen/düşen/hacimli modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("en-cok-hareket");
    expect(def.scope).toBe("global");
  });

  it("varsayılan sekme: en çok yükselenler, azalan sırayla", async () => {
    setup();
    await screen.findAllByTestId("mv-sym");
    expect(syms()).toEqual(["THYAO", "ASELS", "AKBNK", "GARAN"]);
    expect(screen.getAllByTestId("mv-pct")[0]).toHaveTextContent("+10,00%");
  });

  it("'Düşen' sekmesi en çok düşeni başa alır", async () => {
    setup();
    await screen.findAllByTestId("mv-sym");
    await userEvent.click(screen.getByRole("tab", { name: "Düşen" }));
    expect(syms()).toEqual(["GARAN", "AKBNK", "ASELS", "THYAO"]);
    expect(screen.getAllByTestId("mv-pct")[0]).toHaveTextContent("-10,00%");
  });

  it("'Hacimli' sekmesi TL hacme göre sıralar ve hacmi gösterir", async () => {
    setup();
    await screen.findAllByTestId("mv-sym");
    await userEvent.click(screen.getByRole("tab", { name: "Hacimli" }));
    expect(syms()[0]).toBe("AKBNK");
    expect(screen.getAllByTestId("mv-tl")[0]).toHaveTextContent("8,73 mn");
  });

  it("satıra tıklayınca hisse seçilir", async () => {
    setup();
    await userEvent.click((await screen.findAllByTestId("mv-sym"))[0]);
    expect(screen.getByTestId("sel")).toHaveTextContent("THYAO");
  });

  it("en çok 5 satır gösterir", async () => {
    const many: Record<string, any> = {};
    ["AEFES", "AGHOL", "AHGAZ", "AKBNK", "AKCNS", "AKFYE", "AKSA"].forEach((s, i) => {
      many[s] = { price: 100 + i, prevClose: 100, volume: 1 };
    });
    apiMock({ quotes: many });
    render(
      <SelectionProvider>
        <Comp symbol={null} />
      </SelectionProvider>,
    );
    await screen.findAllByTestId("mv-sym");
    expect(screen.getAllByTestId("mv-sym")).toHaveLength(5);
  });

  it("veri gelmezse mesaj verir", async () => {
    apiMock({ quotes: {} });
    render(
      <SelectionProvider>
        <Comp symbol={null} />
      </SelectionProvider>,
    );
    expect(await screen.findByText("Veri yok.")).toBeInTheDocument();
  });
});
