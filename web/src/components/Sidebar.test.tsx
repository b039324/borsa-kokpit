import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { SelectionProvider, useSelection } from "../selection";

const LISTS = {
  BIST30: ["THYAO", "ASELS", "GARAN"],
  BIST100: ["THYAO", "ASELS", "GARAN", "SISE", "KCHOL"],
};

function Probe() {
  const { selected } = useSelection();
  return <div data-testid="probe">{selected ?? "yok"}</div>;
}

function setup(lists = LISTS) {
  render(
    <SelectionProvider>
      <Sidebar lists={lists} />
      <Probe />
    </SelectionProvider>,
  );
}

describe("Sidebar", () => {
  it("varsayılan olarak BIST 30 listesi görünür", () => {
    setup();
    expect(screen.getByRole("tab", { name: "BIST 30", selected: true })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^[A-Z]+$/ })).toHaveLength(3);
  });

  it("BIST 100 sekmesine geçilince liste değişir", async () => {
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "BIST 100" }));
    expect(screen.getByRole("tab", { name: "BIST 100", selected: true })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^[A-Z]+$/ })).toHaveLength(5);
  });

  it("arama kutusu listeyi büyük/küçük harf fark etmeden süzer", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Hisse ara"), "ga");
    const items = screen.getAllByRole("button", { name: /^[A-Z]+$/ });
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("GARAN");
  });

  it("eşleşme yoksa bilgi mesajı çıkar", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Hisse ara"), "zzz");
    expect(screen.getByText("Eşleşen hisse yok.")).toBeInTheDocument();
  });

  it("hisseye tıklanınca seçili hisse güncellenir", async () => {
    setup();
    expect(screen.getByTestId("probe")).toHaveTextContent("yok");
    await userEvent.click(screen.getByRole("button", { name: "ASELS" }));
    expect(screen.getByTestId("probe")).toHaveTextContent("ASELS");
    expect(screen.getByRole("button", { name: "ASELS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "THYAO" })).toHaveAttribute("aria-pressed", "false");
  });

  it("liste boşsa yüklenmedi mesajı çıkar", () => {
    setup({ BIST30: [], BIST100: [] });
    expect(screen.getByText("Hisse listesi henüz yüklenmedi.")).toBeInTheDocument();
  });

  it("favoriler bölümü boş durumla görünür", () => {
    setup();
    expect(screen.getByText("Favoriler")).toBeInTheDocument();
    expect(screen.getByText("Henüz favori yok.")).toBeInTheDocument();
  });
});
