import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./finansal-tablo.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const per = (date: string, revenue: number | null, netIncome: number | null, grossProfit: number | null = null, operatingIncome: number | null = null) => ({
  date, revenue, grossProfit, operatingIncome, netIncome,
});
const body = (over: any = {}) => ({
  symbol: "THYAO",
  currency: "TRY",
  annual: [per("2022-12-31", 120e9, -5e9), per("2023-12-31", 150e9, 30e9, 50e9, 25e9)],
  quarterly: [per("2023-03-31", 30e9, 4e9), per("2024-03-31", 45e9, 6e9)],
  ...over,
});

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("finansal-tablo modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("finansal-tablo");
    expect(def.scope).toBe("stock");
  });

  it("yıllık tabloyu varsayılan gösterir: dönemler, gelir, net kâr, marj", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByTestId("ft-revenue-2023")).toHaveTextContent("150,00 mr");
    expect(screen.getByTestId("ft-netIncome-2023")).toHaveTextContent("30,00 mr");
    expect(screen.getByTestId("ft-grossProfit-2023")).toHaveTextContent("50,00 mr");
    expect(screen.getByTestId("ft-operatingIncome-2023")).toHaveTextContent("25,00 mr");
    expect(screen.getByTestId("ft-netMargin-2023")).toHaveTextContent("20,00%");
  });

  it("büyüme satırları geçen yılın aynı dönemine göre işaretli yüzde gösterir", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("2023");
    expect(screen.getByTestId("ft-revenueYoy-2023")).toHaveTextContent("+25,00%");
    expect(screen.getByTestId("ft-netIncomeYoy-2023")).toHaveTextContent("+700,00%"); // -5 → 30
    expect(screen.getByTestId("ft-revenueYoy-2022")).toHaveTextContent("–");
  });

  it("eksik kalem '–' gösterir; zarar 'down' renkli", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("2023");
    expect(screen.getByTestId("ft-grossProfit-2022")).toHaveTextContent("–");
    const loss = screen.getByTestId("ft-netIncome-2022");
    expect(loss).toHaveTextContent("-5,00 mr");
    expect(loss.className).toContain("down");
    expect(screen.getByTestId("ft-netIncome-2023").className).toContain("up");
  });

  it("Çeyreklik düğmesi çeyreklik dönemleri gösterir, çeyrekte büyüme aynı çeyreğe göredir", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("2023");
    const q = screen.getByRole("button", { name: "Çeyreklik" });
    expect(q).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(q);
    expect(q).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2024 Ç1")).toBeInTheDocument();
    expect(screen.queryByText("2023")).toBeNull();
    expect(screen.getByTestId("ft-revenueYoy-2024 Ç1")).toHaveTextContent("+50,00%");
    expect(screen.getByTestId("ft-netIncomeYoy-2024 Ç1")).toHaveTextContent("+50,00%");
  });

  it("seçilen türde veri yoksa onu söyler", async () => {
    mockFetch(() => ({ status: 200, body: body({ quarterly: [] }) }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("2023");
    await userEvent.click(screen.getByRole("button", { name: "Çeyreklik" }));
    expect(screen.getByText("Bu hisse için çeyreklik veri yok.")).toBeInTheDocument();
  });

  it("hiç veri yoksa açıklama gösterir", async () => {
    mockFetch(() => ({ status: 200, body: body({ annual: [], quarterly: [] }) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Bu hisse için finansal tablo verisi yok.")).toBeInTheDocument();
  });

  it("hata durumunda mesaj verir", async () => {
    mockFetch(() => ({ status: 502, body: { error: "x" } }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Finansal tablo alınamadı")).toBeInTheDocument();
  });

  it("kaynağı ve tutar birimini belirtir", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("2023");
    expect(screen.getByText(/Yahoo/)).toBeInTheDocument();
    expect(screen.getByText(/mr = milyar/)).toBeInTheDocument();
  });
});
