import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./portfoy-pozisyonlar.module";
import { PortfolioProvider } from "../portfolio/PortfolioProvider";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;
const quotes = { AAA: { price: 12, prevClose: 11 }, BBB: { price: 18, prevClose: 19 } };
const seed = [
  { symbol: "AAA", qty: 100, cost: 10 },
  { symbol: "BBB", qty: 50, cost: 20 },
];

function setup(opts: Parameters<typeof apiMock>[0] = {}, symbol: string | null = null) {
  const m = apiMock({ portfolio: seed, quotes, ...opts });
  render(
    <SelectionProvider>
      <PortfolioProvider>
        <Comp symbol={symbol} />
      </PortfolioProvider>
      <Probe />
    </SelectionProvider>,
  );
  return m;
}
const fill = async (label: string, v: string) => {
  const el = screen.getByLabelText(label);
  await userEvent.clear(el);
  await userEvent.type(el, v);
};

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("portfoy-pozisyonlar modülü", () => {
  it("tanım: hisseden bağımsız", () => {
    expect(def.id).toBe("portfoy-pozisyonlar");
    expect(def.scope).toBe("global");
  });

  it("pozisyonları değer ve kâr/zarar ile listeler", async () => {
    setup();
    const row = (await screen.findByText("AAA")).closest("tr")!;
    await waitFor(() => expect(within(row).getByTestId("pp-value")).toHaveTextContent("1.200,00"));
    expect(within(row).getByTestId("pp-pl")).toHaveTextContent("+200,00");
    expect(within(row).getByTestId("pp-plpct")).toHaveTextContent("+20,00%");
    const brow = screen.getByText("BBB").closest("tr")!;
    expect(within(brow).getByTestId("pp-pl")).toHaveTextContent("-100,00");
  });

  it("pozisyon yoksa açıklama gösterir, form yine de görünür", async () => {
    setup({ portfolio: [] });
    expect(await screen.findByText(/Henüz pozisyon yok/)).toBeInTheDocument();
    expect(screen.getByLabelText("Hisse")).toBeInTheDocument();
  });

  it("formdan ekler: kod büyük harfe çevrilir, virgüllü sayı kabul edilir, sunucuya yazılır, form temizlenir", async () => {
    const m = setup();
    await screen.findByText("AAA");
    await fill("Hisse", "ccc");
    await fill("Adet", "5");
    await fill("Maliyet", "20,5");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toContainEqual({ symbol: "CCC", qty: 5, cost: 20.5 }));
    expect(screen.getByLabelText("Hisse")).toHaveValue("");
    expect(screen.getByLabelText("Adet")).toHaveValue("");
  });

  it("eksik ya da geçersiz alanda uyarır ve kaydetmez", async () => {
    const m = setup();
    await screen.findByText("AAA");
    await fill("Hisse", "CCC");
    await fill("Adet", "0");
    await fill("Maliyet", "10");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Hisse kodu, adet ve maliyet gerekli");
    expect(m.portfolioPuts).toHaveLength(0);
  });

  it("geçersiz hisse kodunu reddeder", async () => {
    const m = setup();
    await screen.findByText("AAA");
    await fill("Hisse", "A/B");
    await fill("Adet", "1");
    await fill("Maliyet", "1");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(m.portfolioPuts).toHaveLength(0);
  });

  it("hisse seçiliyse 'Seçili hisse' düğmesi kodu forma yazar", async () => {
    setup({}, "THYAO");
    await screen.findByText("AAA");
    await userEvent.click(screen.getByRole("button", { name: "Seçili hisse (THYAO)" }));
    expect(screen.getByLabelText("Hisse")).toHaveValue("THYAO");
  });

  it("düzenle: adet ve maliyet değiştirilip kaydedilir", async () => {
    const m = setup();
    await userEvent.click(await screen.findByRole("button", { name: "AAA düzenle" }));
    await fill("AAA adet", "120");
    await fill("AAA maliyet", "9,5");
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toContainEqual({ symbol: "AAA", qty: 120, cost: 9.5 }));
    expect(screen.queryByLabelText("AAA adet")).toBeNull();
  });

  it("düzenle: İptal değişiklik yapmaz", async () => {
    const m = setup();
    await userEvent.click(await screen.findByRole("button", { name: "AAA düzenle" }));
    await fill("AAA adet", "999");
    await userEvent.click(screen.getByRole("button", { name: "İptal" }));
    expect(m.portfolioPuts).toHaveLength(0);
    expect(screen.getByText("AAA").closest("tr")).toHaveTextContent("100");
  });

  it("sil: onay verilirse pozisyon silinir ve kaydedilir; onay verilmezse kalır", async () => {
    const m = setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await userEvent.click(await screen.findByRole("button", { name: "AAA sil" }));
    expect(m.portfolioPuts).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "AAA sil" }));
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toEqual([seed[1]]));
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("hisse koduna tıklayınca hisse seçilir", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "AAA" }));
    expect(screen.getByTestId("sel")).toHaveTextContent("AAA");
  });

  it("fiyatı gelmeyen pozisyonda değer ve kâr/zarar '–' olur", async () => {
    setup({ quotes: { AAA: quotes.AAA } });
    const row = (await screen.findByText("BBB")).closest("tr")!;
    await waitFor(() => expect(within(row).getByTestId("pp-value")).toHaveTextContent("–"));
    expect(within(row).getByTestId("pp-pl")).toHaveTextContent("–");
  });

  it("yükleme hatasında mesaj verir", async () => {
    setup({ portfolioGetStatus: 500 });
    expect(await screen.findByText(/Portföy yüklenemedi/)).toBeInTheDocument();
  });

  it("kayıt başarısızsa uyarı yazar", async () => {
    setup({ portfolioPutStatus: 500 });
    await userEvent.click(await screen.findByRole("button", { name: "AAA düzenle" }));
    await fill("AAA adet", "120");
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText(/Son değişiklik kaydedilemedi/)).toBeInTheDocument();
  });
});
