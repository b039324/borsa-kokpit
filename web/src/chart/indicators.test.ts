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
