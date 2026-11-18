import { describe, expect, it } from "vitest";
import { ema, macd, rsi, sma } from "./indicators";

describe("sma", () => {
  it("ilk n-1 değer null, sonrası ortalama", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("n=1 değerin kendisi", () => {
    expect(sma([5, 7], 1)).toEqual([5, 7]);
  });
  it("veri n'den kısaysa hepsi null", () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });
  it("boş dizi", () => {
    expect(sma([], 3)).toEqual([]);
  });
  it("kayan toplam hata biriktirmez", () => {
    const v = Array.from({ length: 1000 }, (_, i) => 100 + (i % 7) * 0.1);
    const r = sma(v, 21);
    const direct = v.slice(979).reduce((a, b) => a + b, 0) / 21;
    expect(r[999]!).toBeCloseTo(direct, 9);
  });
});

describe("ema", () => {
  it("ilk değer basit ortalama, sonrası üstel", () => {
    // n=3, k=0.5: başlangıç (1+2+3)/3=2 ; sonra 4*0.5+2*0.5=3
    expect(ema([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });
  it("veri kısaysa hepsi null", () => expect(ema([1, 2], 3)).toEqual([null, null]));
});

describe("rsi", () => {
  it("elle hesap: [1,2,1,2], n=2 → 50 sonra 75", () => {
    expect(rsi([1, 2, 1, 2], 2)).toEqual([null, null, 50, 75]);
  });
  it("sürekli yükselişte 100, sürekli düşüşte 0", () => {
    const up = Array.from({ length: 30 }, (_, i) => i);
    expect(rsi(up).at(-1)).toBe(100);
    expect(rsi([...up].reverse()).at(-1)).toBe(0);
  });
  it("hiç hareket yoksa 50", () => expect(rsi(Array(20).fill(5)).at(-1)).toBe(50));
  it("n+1'den az veride hepsi null", () => expect(rsi([1, 2, 3], 14).every((v) => v === null)).toBe(true));
  it("değerler hep 0–100 arasında", () => {
    const v = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 3) * 10 + (i % 5));
    for (const r of rsi(v)) if (r !== null) { expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(100); }
  });
});

describe("macd", () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5 + Math.sin(i / 4) * 3);
  it("ilk MACD değeri 26. mumda, sinyal 34. mumda, histogram sinyalle aynı yerde başlar", () => {
    const m = macd(closes);
    expect(m.macd.findIndex((v) => v !== null)).toBe(25);
    expect(m.signal.findIndex((v) => v !== null)).toBe(33);
    expect(m.hist.findIndex((v) => v !== null)).toBe(33);
  });
  it("histogram = MACD − sinyal", () => {
    const m = macd(closes);
    const i = 60;
    expect(m.hist[i]!).toBeCloseTo(m.macd[i]! - m.signal[i]!, 12);
  });
  it("yükselen trendde MACD pozitif", () => {
    const up = Array.from({ length: 60 }, (_, i) => 100 + i);
    expect(macd(up).macd.at(-1)!).toBeGreaterThan(0);
  });
  it("kısa veride hepsi null", () => {
    expect(macd([1, 2, 3]).macd.every((v) => v === null)).toBe(true);
  });
});

import { atr, bollinger, stochastic } from "./indicators";
import type { Candle } from "../api";

const cd = (h: number, l: number, c: number): Candle => ({ t: 0, o: c, h, l, c, v: 0 });

describe("bollinger", () => {
  it("orta bant SMA, bantlar ±k standart sapma (popülasyon)", () => {
    // 1,2,3,4,5 → ort 3, popülasyon sapması √2
    const b = bollinger([1, 2, 3, 4, 5], 5, 2);
    expect(b.mid[4]).toBe(3);
    expect(b.upper[4]!).toBeCloseTo(3 + 2 * Math.SQRT2, 9);
    expect(b.lower[4]!).toBeCloseTo(3 - 2 * Math.SQRT2, 9);
  });
  it("ilk n-1 değer null", () => {
    const b = bollinger([1, 2, 3, 4, 5], 5);
    expect(b.mid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(b.upper.slice(0, 4)).toEqual([null, null, null, null]);
  });
  it("sabit seride bantlar daralır (sapma 0)", () => {
    const b = bollinger([7, 7, 7], 3);
    expect(b.upper[2]).toBe(7);
    expect(b.lower[2]).toBe(7);
  });
  it("veri kısaysa hepsi null", () => {
    expect(bollinger([1, 2], 20).mid).toEqual([null, null]);
  });
});

describe("atr", () => {
  it("ilk ATR ilk n gerçek aralığın ortalaması (n-1. indekste)", () => {
    // TR: 2, 2, 2 (kapanış aralık içinde) → ATR 2
    const c = [cd(11, 9, 10), cd(11, 9, 10), cd(11, 9, 10)];
    const a = atr(c, 3);
    expect(a.slice(0, 2)).toEqual([null, null]);
    expect(a[2]).toBe(2);
  });
  it("gerçek aralık önceki kapanıştan boşluğu da sayar", () => {
    // 2. mum: h=21 l=20, önceki kapanış 10 → TR = max(1, 11, 10) = 11
    const c = [cd(11, 9, 10), cd(21, 20, 20)];
    const a = atr(c, 2);
    expect(a[1]).toBe((2 + 11) / 2);
  });
  it("Wilder yumuşatma: sonraki ATR = (önceki*(n-1)+TR)/n", () => {
    const c = [cd(11, 9, 10), cd(11, 9, 10), cd(16, 10, 10)]; // TR: 2, 2, 6
    const a = atr(c, 2);
    expect(a[1]).toBe(2);
    expect(a[2]).toBe((2 * 1 + 6) / 2);
  });
  it("veri kısaysa hepsi null; boş dizi", () => {
    expect(atr([cd(2, 1, 1)], 14)).toEqual([null]);
    expect(atr([], 14)).toEqual([]);
  });
});

describe("stochastic", () => {
  it("kapanış aralığın tepesindeyse ham %K = 100, dipteyse 0", () => {
    const up = [cd(10, 0, 5), cd(10, 0, 10)];
    const s1 = stochastic(up, 2, 1, 1);
    expect(s1.k[1]).toBe(100);
    const dn = [cd(10, 0, 5), cd(10, 0, 0)];
    expect(stochastic(dn, 2, 1, 1).k[1]).toBe(0);
  });
  it("aralık sıfırsa %K = 50 (bölme hatası yok)", () => {
    const flat = [cd(5, 5, 5), cd(5, 5, 5)];
    expect(stochastic(flat, 2, 1, 1).k[1]).toBe(50);
  });
  it("yavaş %K ham değerin SMA'sı, %D onun SMA'sı", () => {
    // ham %K: 100, 0, 100 (n=1 değil n=2 ile kurmak yerine doğrudan n=1 dışı)
    const c = [cd(10, 0, 0), cd(10, 0, 10), cd(10, 0, 0), cd(10, 0, 10)];
    // n=2: ham = [null, 100, 0, 100]; k=smooth 2 → [null, null, 50, 50]; d=2 → [null,null,null,50]
    const s = stochastic(c, 2, 2, 2);
    expect(s.k).toEqual([null, null, 50, 50]);
    expect(s.d).toEqual([null, null, null, 50]);
  });
  it("veri kısaysa null", () => {
    expect(stochastic([cd(2, 1, 1)], 14).k).toEqual([null]);
  });
});
