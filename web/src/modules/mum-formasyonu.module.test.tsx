import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import def from "./mum-formasyonu.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
// 2026-11-10'dan itibaren günlük mumlar (UTC 12:00), TR günü = aynı gün
const base = Date.UTC(2026, 10, 10, 12) / 1000;
const mk = (o: number, h: number, l: number, c: number, i: number) => ({ t: base + i * 86400, o, h, l, c, v: 1 });
const filler = (c: number, i: number) => mk(c + 0.5, c + 1, c - 1, c, i);
const body = (candles: any[]) => ({ symbol: "THYAO", period: "3a", currency: "TRY", price: 106, prevClose: 100, gmtoffset: 10800, candles });

// 3 dolgu + kırmızı mum + onu yutan yeşil mum (yutan boğa, son mumda)
const engulf = [filler(110, 0), filler(108, 1), filler(106, 2), mk(105, 105.5, 99.5, 100, 3), mk(99, 106.5, 98.5, 106, 4)];
const plain = [100, 101, 102, 103, 104, 105].map((c, i) => filler(c, i));

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("mum formasyonu modülü", () => {
  it("tanım: hisse kapsamlı", () => {
    expect(def.id).toBe("mum-formasyonu");
    expect(def.scope).toBe("stock");
  });

  it("bulunan formasyonu tarih, yön etiketi ve açıklamayla listeler", async () => {
    mockFetch(() => ({ status: 200, body: body(engulf) }));
    render(<Comp symbol="THYAO" />);
    const row = await screen.findByTestId("pattern-bullish-engulfing");
    expect(row).toHaveTextContent("Yutan boğa");
    expect(row).toHaveTextContent("14.11"); // 4. gün: 10 Kasım + 4
    expect(within(row).getByText("Yükseliş")).toBeInTheDocument();
    expect(row).toHaveTextContent("tamamen yuttu");
  });

  it("yön etiketleri: düşüş ve kararsızlık", async () => {
    const doji = [...plain, mk(100, 105, 95, 100.5, 6)];
    mockFetch(() => ({ status: 200, body: body(doji) }));
    render(<Comp symbol="THYAO" />);
    const row = await screen.findByTestId("pattern-doji");
    expect(within(row).getByText("Kararsızlık")).toBeInTheDocument();
  });

  it("formasyon yoksa bilgi verir", async () => {
    mockFetch(() => ({ status: 200, body: body(plain) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Son 10 günde belirgin formasyon yok.")).toBeInTheDocument();
  });

  it("not: tek başına tahmin değildir", async () => {
    mockFetch(() => ({ status: 200, body: body(engulf) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText(/tek başına/i)).toHaveTextContent(/tavsiyesi değildir/i);
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });

  it("yükleniyor durumu gösterir", () => {
    mockFetch(() => ({ status: 200, body: body(engulf) }));
    render(<Comp symbol="THYAO" />);
    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();
  });
});
