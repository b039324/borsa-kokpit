import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./volatilite-siralamasi.module";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

const stats = {
  THYAO: { vol: 0.52 },
  GARAN: { vol: 0.31 },
  AKBNK: { vol: 0.9 },
  ASELS: {}, // oynaklık yok
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
const syms = () => screen.getAllByTestId("vs-sym").map((e) => e.textContent);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("volatilite sıralaması modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("volatilite-siralamasi");
    expect(def.scope).toBe("global");
  });

  it("varsayılan: en oynaktan başlar, yıllık oynaklığı gösterir", async () => {
    setup();
    await screen.findAllByTestId("vs-sym");
    expect(syms()).toEqual(["AKBNK", "THYAO", "GARAN"]);
    expect(screen.getAllByTestId("vs-vol")[0]).toHaveTextContent("90,00%");
  });

  it("'En sakin' sekmesi sırayı tersine çevirir", async () => {
    setup();
    await screen.findAllByTestId("vs-sym");
    await userEvent.click(screen.getByRole("tab", { name: "En sakin" }));
    expect(syms()).toEqual(["GARAN", "THYAO", "AKBNK"]);
  });

  it("satıra tıklayınca hisse seçilir", async () => {
    setup();
    await userEvent.click((await screen.findAllByTestId("vs-sym"))[0]);
    expect(screen.getByTestId("sel")).toHaveTextContent("AKBNK");
  });

  it("açıklama notu: son ~60 gün, yatırım tavsiyesi değildir", async () => {
    setup();
    await screen.findAllByTestId("vs-sym");
    expect(screen.getByText(/tavsiyesi değildir/i)).toBeInTheDocument();
  });

  it("veri gelmezse mesaj verir", async () => {
    setup({});
    expect(await screen.findByText("Veri yok.")).toBeInTheDocument();
  });
});
