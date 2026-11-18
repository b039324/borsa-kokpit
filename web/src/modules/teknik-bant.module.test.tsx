import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import def, { bandZone, stochZone } from "./teknik-bant.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
// Her mumun aralığı ±1: gerçek aralık (ATR) hep 2.
const mk = (closes: number[]) => ({
  symbol: "X", period: "3a", currency: "TRY", price: closes.at(-1), prevClose: closes.at(-2), gmtoffset: 10800,
  candles: closes.map((c, i) => ({ t: 1_700_000_000 + i * 86400, o: c, h: c + 1, l: c - 1, c, v: 1 })),
});
const up = Array.from({ length: 60 }, (_, i) => 100 + i);
const down = [...up].reverse();

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("bandZone", () => {
  it.each([
    [1.2, "Üst bandın üstünde"],
    [1, "Üst banda yakın"],
    [0.8, "Üst banda yakın"],
    [0.5, "Bantların içinde"],
    [0.2, "Alt banda yakın"],
    [0, "Alt banda yakın"],
    [-0.1, "Alt bandın altında"],
  ])("%B %s → %s", (v, label) => expect(bandZone(v).label).toBe(label));
});

describe("stochZone", () => {
  it.each([
    [80, "Aşırı alım bölgesi"],
    [95, "Aşırı alım bölgesi"],
    [20, "Aşırı satım bölgesi"],
    [5, "Aşırı satım bölgesi"],
    [50, "Nötr bölge"],
  ])("%K %s → %s", (v, label) => expect(stochZone(v).label).toBe(label));
});

describe("teknik-bant modülü", () => {
  it("tanım geçerli", () => {
    expect(def.id).toBe("teknik-bant");
    expect(def.scope).toBe("stock");
  });

  it("sabit yükselişte: üst banda yakın, ATR 2, %K ≈ 93,3 aşırı alım", async () => {
    mockFetch(() => ({ status: 200, body: mk(up) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Üst banda yakın")).toBeInTheDocument();
    expect(screen.getByTestId("bb-pctb")).toHaveTextContent("0,91");
    expect(screen.getByTestId("atr-val")).toHaveTextContent("2,00");
    expect(screen.getByTestId("atr-pct")).toHaveTextContent("1,26%");
    expect(screen.getByTestId("st-k")).toHaveTextContent("93,3");
    expect(screen.getByText("Aşırı alım bölgesi")).toBeInTheDocument();
  });

  it("sabit düşüşte: alt banda yakın, %K ≈ 6,7 aşırı satım", async () => {
    mockFetch(() => ({ status: 200, body: mk(down) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Alt banda yakın")).toBeInTheDocument();
    expect(screen.getByTestId("st-k")).toHaveTextContent("6,7");
    expect(screen.getByText("Aşırı satım bölgesi")).toBeInTheDocument();
  });

  it("bant değerleri alt < orta < üst sırasıyla gösterilir", async () => {
    mockFetch(() => ({ status: 200, body: mk(up) }));
    render(<Comp symbol="THYAO" />);
    await screen.findByTestId("bb-pctb");
    const num = (id: string) => Number(screen.getByTestId(id).textContent!.replace(/\./g, "").replace(",", "."));
    expect(num("bb-lower")).toBeLessThan(num("bb-mid"));
    expect(num("bb-mid")).toBeLessThan(num("bb-upper"));
  });

  it("fiyat değişmiyorsa bant genişliği sıfır notu, %K 50 nötr", async () => {
    mockFetch(() => ({ status: 200, body: mk(Array(40).fill(100)) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Bantlar daraldı (oynaklık yok)")).toBeInTheDocument();
    expect(screen.getByTestId("st-k")).toHaveTextContent("50,0");
    expect(screen.getByText("Nötr bölge")).toBeInTheDocument();
  });

  it("20'den az mum varsa yetersiz veri mesajı", async () => {
    mockFetch(() => ({ status: 200, body: mk(up.slice(0, 15)) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/en az 20 gerekir/)).toBeInTheDocument();
  });

  it("hata ve veri yoksa mesaj verir", async () => {
    mockFetch(() => ({ status: 500, body: { error: "x" } }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/.+/, { selector: "p.muted" })).toBeInTheDocument();
  });

  it("%K %D'nin üstündeyse 'yönü yazar", async () => {
    mockFetch(() => ({ status: 200, body: mk([...down.slice(0, 45), ...up.slice(0, 8)]) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("%K, %D'nin üstünde")).toBeInTheDocument();
  });
});
