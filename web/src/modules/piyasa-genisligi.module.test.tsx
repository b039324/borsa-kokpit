import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./piyasa-genisligi.module";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

const quotes = {
  THYAO: { price: 110, prevClose: 100 }, // +10 → tavana yakın
  ASELS: { price: 103, prevClose: 100 }, // +3
  AKBNK: { price: 100, prevClose: 100 }, // 0
  GARAN: { price: 90, prevClose: 100 }, // -10 → tabana yakın
  ISCTR: { price: 95, prevClose: 100 }, // -5
  SISE: { price: 96, prevClose: 100 }, // -4
};

function setup(q: Record<string, any> = quotes) {
  apiMock({ quotes: q });
  render(
    <SelectionProvider>
      <Comp symbol={null} />
      <Probe />
    </SelectionProvider>,
  );
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("piyasa genişliği modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("piyasa-genisligi");
    expect(def.scope).toBe("global");
  });

  it("yükselen, düşen ve yatay sayısını gösterir", async () => {
    setup();
    expect(await screen.findByTestId("br-up")).toHaveTextContent("2");
    expect(screen.getByTestId("br-down")).toHaveTextContent("3");
    expect(screen.getByTestId("br-flat")).toHaveTextContent("1");
  });

  it("yükselenlerin oranını yüzde olarak gösterir", async () => {
    setup();
    expect(await screen.findByTestId("br-ratio")).toHaveTextContent("33,33%");
  });

  it("tavana ve tabana yakın hisseleri listeler", async () => {
    setup();
    await screen.findByTestId("br-up");
    expect(screen.getByTestId("br-near-up")).toHaveTextContent("THYAO");
    expect(screen.getByTestId("br-near-up")).not.toHaveTextContent("ASELS");
    expect(screen.getByTestId("br-near-down")).toHaveTextContent("GARAN");
  });

  it("yakın hisse yoksa 'Yok' yazar", async () => {
    setup({ AKBNK: { price: 101, prevClose: 100 } });
    await screen.findByTestId("br-up");
    expect(screen.getByTestId("br-near-up")).toHaveTextContent("Yok");
    expect(screen.getByTestId("br-near-down")).toHaveTextContent("Yok");
  });

  it("listedeki hisseye tıklayınca seçilir", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: /^THYAO/ }));
    expect(screen.getByTestId("sel")).toHaveTextContent("THYAO");
  });

  it("veri yoksa mesaj verir", async () => {
    setup({});
    expect(await screen.findByText("Veri yok.")).toBeInTheDocument();
  });
});
