import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./temettu-bolunme.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const data = (over: any = {}) => ({
  symbol: "THYAO",
  currency: "TRY",
  dividends: [
    { date: "2024-03-01", amount: 1 },
    { date: "2023-08-01", amount: 2 },
    { date: "2023-05-16", amount: 3 },
  ],
  splits: [{ date: "2021-08-02", numerator: 2, denominator: 1 }],
  ...over,
});

function route(div: any = data(), price: number | null = 100, divStatus = 200) {
  mockFetch((url) => {
    if (url.includes("/api/dividends")) return { status: divStatus, body: div };
    if (url.includes("/api/quotes")) {
      return { status: 200, body: { quotes: price === null ? [] : [{ symbol: "THYAO", price, prevClose: price, volume: 1 }], failed: price === null ? ["THYAO"] : [] } };
    }
    return { status: 404, body: {} };
  });
}

beforeEach(() => {
  localStorage.setItem(TOKEN_KEY, "tok");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2024-06-01T09:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("temettu-bolunme modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("temettu-bolunme");
    expect(def.scope).toBe("stock");
  });

  it("son 12 ay toplam temettü ve güncel fiyata göre verimi gösterir", async () => {
    route();
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("dv-ttm")).toHaveTextContent("3,00 TL");
    await vi.waitFor(() => expect(screen.getByTestId("dv-yield")).toHaveTextContent("3,00%"));
  });

  it("fiyat gelmezse verim '–' olur, toplam yine görünür", async () => {
    route(data(), null);
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("dv-ttm")).toHaveTextContent("3,00 TL");
    expect(screen.getByTestId("dv-yield")).toHaveTextContent("–");
  });

  it("yıl bazlı toplamları gösterir", async () => {
    route();
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByTestId("dv-year-2023")).toHaveTextContent("5,00");
    expect(screen.getByTestId("dv-year-2024")).toHaveTextContent("1,00");
  });

  it("son ödemeleri tarih (GG.AA.YYYY) ve tutarla listeler", async () => {
    route();
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("16.05.2023")).toBeInTheDocument();
    expect(screen.getByTestId("dv-pay-2023-05-16")).toHaveTextContent("3,00");
  });

  it("bölünmeleri tarih ve oranla gösterir, bedelsiz notu düşer", async () => {
    route();
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("02.08.2021")).toBeInTheDocument();
    expect(screen.getByTestId("dv-split-2021-08-02")).toHaveTextContent("2:1");
    expect(screen.getByText(/sermaye artırımlarını/)).toBeInTheDocument();
  });

  it("temettü yoksa açıklama, bölünme yoksa açıklama gösterir", async () => {
    route(data({ dividends: [], splits: [] }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Son 10 yılda temettü kaydı yok.")).toBeInTheDocument();
    expect(screen.getByText("Bölünme / bedelsiz kaydı yok.")).toBeInTheDocument();
    expect(screen.queryByTestId("dv-ttm")).toBeNull();
  });

  it("hata durumunda mesaj verir", async () => {
    route({}, 100, 502);
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Temettü verisi alınamadı")).toBeInTheDocument();
  });
});
