import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def from "./getiri-donemleri.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const DAY = 86400;
const NOW = 1_700_000_000;
const cd = (daysAgo: number, c: number, h = c, l = c) => ({ t: NOW - daysAgo * DAY, o: c, h, l, c, v: 1 });

// 3a: günlük; 6a ve 1y: haftalık mumlar
const daily = [cd(92, 50), cd(40, 80), cd(31, 90), cd(8, 95), cd(0, 100)];
const w6 = [cd(184, 40), cd(100, 60), cd(0, 100)];
const w1y = [cd(364, 25, 30, 20), cd(200, 70, 150, 60), cd(0, 100)];

function body(period: string) {
  const candles = period === "3a" ? daily : period === "6a" ? w6 : w1y;
  return { symbol: "THYAO", period, currency: "TRY", price: 100, prevClose: 98, gmtoffset: 10800, candles };
}

function setup() {
  mockFetch((url) => {
    const m = /period=([^&]+)/.exec(url);
    return { status: 200, body: body(m ? decodeURIComponent(m[1]) : "3a") };
  });
  return render(<Comp symbol="THYAO" />);
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("dönem getirileri modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("getiri-donemleri");
    expect(def.scope).toBe("stock");
  });

  it("günlükten yıllığa getirileri hesaplar", async () => {
    setup();
    expect(await screen.findByTestId("ret-1g")).toHaveTextContent("+2,04%"); // 100/98
    expect(screen.getByTestId("ret-1h")).toHaveTextContent("+5,26%"); // 7g önce: 8 gün önceki 95
    expect(screen.getByTestId("ret-1a")).toHaveTextContent("+11,11%"); // 30g önce: 31 gün önceki 90
    expect(screen.getByTestId("ret-3a")).toHaveTextContent("+100,00%"); // ilk mum 92 gün önce, 50
    expect(screen.getByTestId("ret-6a")).toHaveTextContent("+150,00%"); // 182g önce: 184 gün önceki 40
    expect(screen.getByTestId("ret-1y")).toHaveTextContent("+300,00%"); // 364 gün önce, 25
  });

  it("52 hafta aralığını ve konumunu gösterir", async () => {
    setup();
    expect(await screen.findByTestId("r52-low")).toHaveTextContent("20,00");
    expect(screen.getByTestId("r52-high")).toHaveTextContent("150,00");
    expect(screen.getByTestId("r52-pos")).toHaveTextContent("%61,5"); // (100-20)/130
  });

  it("düşüş kırmızı, artış yeşil sınıf alır", async () => {
    mockFetch(() => ({
      status: 200,
      body: { symbol: "X", period: "3a", currency: "TRY", price: 80, prevClose: 100, gmtoffset: 0, candles: [cd(40, 100), cd(0, 80)] },
    }));
    render(<Comp symbol="X" />);
    expect(await screen.findByTestId("ret-1g")).toHaveClass("down");
    expect(screen.getByTestId("ret-1g")).toHaveTextContent("-20,00%");
  });

  it("verisi yetmeyen dönem '–' gösterir", async () => {
    mockFetch(() => ({
      status: 200,
      body: { symbol: "X", period: "3a", currency: "TRY", price: 100, prevClose: 99, gmtoffset: 0, candles: [cd(5, 99), cd(0, 100)] },
    }));
    render(<Comp symbol="X" />);
    expect(await screen.findByTestId("ret-1y")).toHaveTextContent("–");
    expect(screen.getByTestId("ret-3a")).toHaveTextContent("–");
  });

  it("veri gelmezse mesaj verir", async () => {
    mockFetch(() => ({ status: 500 }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/Veri yok|alınamadı/i)).toBeInTheDocument();
  });
});
