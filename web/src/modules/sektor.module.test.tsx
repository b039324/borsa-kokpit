import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./sektor.module";
import { SelectionProvider, useSelection } from "../selection";
import { SYMBOL_LISTS } from "../data/symbols";
import { SECTORS } from "../data/sectors";
import { apiMock, mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;

// Herkes %0; GARAN (Banka) +%10 ve çok hacimli; THYAO (Ulaştırma) −%5 ama en büyük TL hacim.
function quotes(over: Record<string, any> = {}) {
  const q: Record<string, any> = {};
  SYMBOL_LISTS.BIST100.forEach((s) => (q[s] = { price: 10, prevClose: 10, volume: 1000 }));
  q.GARAN = { price: 110, prevClose: 100, volume: 10_000 };
  q.THYAO = { price: 95, prevClose: 100, volume: 5_000_000 };
  return { ...q, ...over };
}

function setup(q = quotes()) {
  apiMock({ quotes: q });
  render(
    <SelectionProvider>
      <Comp symbol={null} />
      <Probe />
    </SelectionProvider>,
  );
}
const rowNames = () => screen.getAllByTestId("sector-row").map((r) => within(r).getAllByRole("button")[0].textContent ?? "");

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("sektör modülü", () => {
  it("tanım: hisseden bağımsız (global)", () => {
    expect(def.id).toBe("sektor");
    expect(def.scope).toBe("global");
  });

  it("tüm sektörleri listeler", async () => {
    setup();
    await screen.findAllByTestId("sector-row");
    expect(screen.getAllByTestId("sector-row")).toHaveLength(Object.keys(SECTORS).length);
  });

  it("varsayılan sıralama değişime göre: en çok yükselen üstte, en çok düşen altta", async () => {
    setup();
    await screen.findAllByTestId("sector-row");
    const names = rowNames();
    expect(names[0]).toMatch(/^Banka/);
    expect(names.at(-1)).toMatch(/^Ulaştırma/);
  });

  it("'Hacim (TL)' sıralaması en büyük hacimli sektörü üste alır", async () => {
    setup();
    await screen.findAllByTestId("sector-row");
    await userEvent.click(screen.getByRole("button", { name: "Hacim (TL)" }));
    expect(rowNames()[0]).toMatch(/^Ulaştırma/);
    expect(screen.getByRole("button", { name: "Hacim (TL)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sektör başlığında yüzde değişim ve hesaba giren/toplam hisse sayısı görünür", async () => {
    setup();
    const rows = await screen.findAllByTestId("sector-row");
    const ulas = rows.find((r) => r.textContent?.startsWith("Ulaştırma"))!;
    expect(ulas).toHaveTextContent(`4/${SECTORS["Ulaştırma"].length}`);
    expect(ulas.querySelector(".price-chg")).toHaveClass("down");
  });

  it("sektöre tıklayınca üyeleri açılır; hisseye tıklayınca seçilir", async () => {
    setup();
    const rows = await screen.findAllByTestId("sector-row");
    const banka = rows.find((r) => r.textContent?.startsWith("Banka"))!;
    await userEvent.click(within(banka).getAllByRole("button")[0]);
    expect(within(banka).getByRole("button", { name: /^GARAN/ })).toHaveTextContent("+10,00%");
    await userEvent.click(within(banka).getByRole("button", { name: /^GARAN/ }));
    expect(screen.getByTestId("sel")).toHaveTextContent("GARAN");
  });

  it("ikinci tıklama sektörü kapatır", async () => {
    setup();
    const rows = await screen.findAllByTestId("sector-row");
    const head = within(rows[0]).getAllByRole("button")[0];
    await userEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "false");
  });

  it("verisi gelmeyen sektör tire gösterir ve en alta iner", async () => {
    const q = quotes();
    for (const s of SECTORS["Spor"]) q[s] = { price: 10, prevClose: 10 }; // hacim yok
    setup(q);
    await screen.findAllByTestId("sector-row");
    const names = rowNames();
    expect(names.at(-1)).toMatch(/^Spor/);
    expect(screen.getAllByTestId("sector-row").at(-1)).toHaveTextContent("–");
  });

  it("resmî endeks olmadığı notunu gösterir", async () => {
    setup();
    await screen.findAllByTestId("sector-row");
    expect(screen.getByText(/resmî sektör endeksi değildir/)).toBeInTheDocument();
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 502 }));
    render(
      <SelectionProvider>
        <Comp symbol={null} />
      </SelectionProvider>,
    );
    expect(await screen.findByText("Fiyatlar alınamadı")).toBeInTheDocument();
  });
});
