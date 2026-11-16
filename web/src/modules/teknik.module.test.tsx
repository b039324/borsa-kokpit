import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def, { rsiZone } from "./teknik.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const mk = (closes: number[]) => ({
  symbol: "X", period: "3a", currency: "TRY", price: closes.at(-1), prevClose: closes.at(-2), gmtoffset: 10800,
  candles: closes.map((c, i) => ({ t: 1_700_000_000 + i * 86400, o: c, h: c, l: c, c, v: 1 })),
});
const up = Array.from({ length: 60 }, (_, i) => 100 + i);
const down = [...up].reverse();
const accelDown = Array.from({ length: 60 }, (_, i) => 200 - i * i * 0.05); // düşüş hızlanıyor
const accelUp = Array.from({ length: 60 }, (_, i) => 100 + i * i * 0.05);

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("rsiZone", () => {
  it.each([
    [70, "Aşırı alım bölgesi"],
    [85, "Aşırı alım bölgesi"],
    [30, "Aşırı satım bölgesi"],
    [10, "Aşırı satım bölgesi"],
    [50, "Nötr bölge"],
    [69.9, "Nötr bölge"],
    [30.1, "Nötr bölge"],
  ])("%s → %s", (v, label) => expect(rsiZone(v).label).toBe(label));
});

describe("teknik modülü", () => {
  it("tanım geçerli", () => {
    expect(def.id).toBe("teknik");
    expect(def.scope).toBe("stock");
  });

  it("sürekli yükselişte RSI 100 (aşırı alım) ve MACD pozitif momentum", async () => {
    mockFetch(() => ({ status: 200, body: mk(up) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("100,0")).toBeInTheDocument();
    expect(screen.getByText("Aşırı alım bölgesi")).toBeInTheDocument();
    expect(screen.getByText("MACD (12, 26, 9)")).toBeInTheDocument();
  });

  it("sürekli düşüşte RSI 0 (aşırı satım) ve MACD negatif", async () => {
    mockFetch(() => ({ status: 200, body: mk(down) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("0,0")).toBeInTheDocument();
    expect(screen.getByText("Aşırı satım bölgesi")).toBeInTheDocument();
  });

  it("hızlanan düşüşte histogram negatif: 'negatif momentum' yazar", async () => {
    mockFetch(() => ({ status: 200, body: mk(accelDown) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/negatif momentum/)).toHaveClass("down");
  });

  it("hızlanan yükselişte histogram pozitif: 'pozitif momentum' yazar", async () => {
    mockFetch(() => ({ status: 200, body: mk(accelUp) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/pozitif momentum/)).toHaveClass("up");
  });

  it("düz çizgi gibi trendde histogram ~0: yön iddia etmez", async () => {
    mockFetch(() => ({ status: 200, body: mk(up) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("MACD sinyal ile eşit")).toBeInTheDocument();
  });

  it("veri azsa açıklayıcı mesaj gösterir", async () => {
    mockFetch(() => ({ status: 200, body: mk(up.slice(0, 20)) }));
    render(<Comp symbol="NEWIPO" />);
    expect(await screen.findByText(/yeterli geçmiş veri yok \(20 mum/)).toBeInTheDocument();
  });

  it("günlük dönem (3a) ister", async () => {
    const f = mockFetch(() => ({ status: 200, body: mk(up) }));
    render(<Comp symbol="THYAO" />);
    await screen.findByText("100,0");
    expect(String(f.mock.calls[0][0])).toContain("period=3a");
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });
});
