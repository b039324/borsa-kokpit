import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./temel.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const none = {
  marketCap: null, trailingPE: null, forwardPE: null, priceToBook: null, priceToSales: null, enterpriseToEbitda: null,
  trailingEps: null, bookValue: null, dividendYield: null, beta: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
  fiftyDayAverage: null, twoHundredDayAverage: null, returnOnEquity: null, returnOnAssets: null, grossMargins: null,
  operatingMargins: null, profitMargins: null, revenueGrowth: null, earningsGrowth: null, debtToEquity: null, currentRatio: null,
};
const body = (over: any = {}) => ({
  symbol: "THYAO", name: "Turk Hava Yollari A.O.", currency: "TRY", ...none,
  marketCap: 450_000_000_000, trailingPE: 4.2, priceToBook: 1.1, dividendYield: 0.021, returnOnEquity: 0.28,
  debtToEquity: 95.5, earningsGrowth: -0.1, revenueGrowth: 0.2, fiftyTwoWeekHigh: 340,
  ...over,
});

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("temel analiz modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("temel");
    expect(def.scope).toBe("stock");
  });

  it("şirket adını ve değerleme/kârlılık/borç oranlarını gösterir", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Turk Hava Yollari A.O.")).toBeInTheDocument();
    expect(screen.getByTestId("f-marketCap")).toHaveTextContent("450,00 mr");
    expect(screen.getByTestId("f-trailingPE")).toHaveTextContent("4,20");
    expect(screen.getByTestId("f-priceToBook")).toHaveTextContent("1,10");
    expect(screen.getByTestId("f-returnOnEquity")).toHaveTextContent("28,00%");
    expect(screen.getByTestId("f-dividendYield")).toHaveTextContent("2,10%");
    expect(screen.getByTestId("f-debtToEquity")).toHaveTextContent("95,50%");
    expect(screen.getByTestId("f-fiftyTwoWeekHigh")).toHaveTextContent("340,00");
  });

  it("büyümede artış yeşil, düşüş kırmızı", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    await screen.findByTestId("f-trailingPE");
    expect(screen.getByTestId("f-revenueGrowth")).toHaveTextContent("+20,00%");
    expect(screen.getByTestId("f-revenueGrowth")).toHaveClass("up");
    expect(screen.getByTestId("f-earningsGrowth")).toHaveTextContent("-10,00%");
    expect(screen.getByTestId("f-earningsGrowth")).toHaveClass("down");
  });

  it("eksik alan tire gösterir", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    await screen.findByTestId("f-trailingPE");
    expect(screen.getByTestId("f-forwardPE")).toHaveTextContent("–");
  });

  it("hiç veri yoksa bilgi mesajı verir", async () => {
    mockFetch(() => ({ status: 200, body: { symbol: "XYZ", name: null, currency: null, ...none } }));
    render(<Comp symbol="XYZ" />);
    expect(await screen.findByText("Bu hisse için temel veri bulunamadı.")).toBeInTheDocument();
  });

  it("kaynak notu: Yahoo, eksik olabilir, bilgi amaçlıdır", async () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/Yahoo/)).toHaveTextContent(/bilgi amaçlıdır/i);
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });

  it("yükleniyor durumu gösterir", () => {
    mockFetch(() => ({ status: 200, body: body() }));
    render(<Comp symbol="THYAO" />);
    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();
  });
});
