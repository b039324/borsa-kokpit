import { describe, it, expect } from "vitest";
import { range52, returnSince } from "./periods";

const DAY = 86400;
const c = (daysAgo: number, close: number, h = close, l = close) => ({
  t: 1_700_000_000 - daysAgo * DAY,
  o: close,
  h,
  l,
  c: close,
  v: 1,
});
const NOW = 1_700_000_000;

describe("returnSince", () => {
  it("hedef günden önceki son kapanışa göre getiri verir", () => {
    const candles = [c(40, 80), c(31, 90), c(29, 95), c(0, 100)];
    // 30 gün önce: t <= NOW-30g olan son mum = 31 gün önceki (90)
    expect(returnSince(candles, 99, NOW, 30)).toBeCloseTo(99 / 90 - 1);
  });

  it("veri hedefe yetmiyorsa null", () => {
    expect(returnSince([c(10, 100), c(0, 101)], 101, NOW, 91)).toBeNull();
  });

  it("veri hedeften en çok 8 gün geç başlıyorsa (haftalık mum) ilk mumu kullanır", () => {
    const candles = [c(360, 50), c(353, 55), c(0, 100)];
    expect(returnSince(candles, 100, NOW, 365)).toBeCloseTo(100 / 50 - 1);
    expect(returnSince([c(350, 50), c(0, 100)], 100, NOW, 365)).toBeNull();
  });

  it("boş dizi, sıfır/geçersiz referans fiyatı null", () => {
    expect(returnSince([], 100, NOW, 7)).toBeNull();
    expect(returnSince([c(10, 0), c(0, 1)], 1, NOW, 7)).toBeNull();
  });
});

describe("range52", () => {
  it("en düşük, en yüksek ve konumu (0..1) verir", () => {
    const candles = [c(300, 70, 120, 60), c(100, 90, 95, 80), c(0, 100, 105, 98)];
    expect(range52(candles, 90)).toEqual({ low: 60, high: 120, pos: 0.5 });
  });

  it("güncel fiyat aralığın dışındaysa aralığı genişletir", () => {
    const candles = [c(10, 100, 110, 90)];
    expect(range52(candles, 120)).toEqual({ low: 90, high: 120, pos: 1 });
    expect(range52(candles, 80)).toEqual({ low: 80, high: 110, pos: 0 });
  });

  it("veri yoksa ya da yüksek=düşük ise null", () => {
    expect(range52([], 10)).toBeNull();
    expect(range52([c(1, 10)], 10)).toBeNull();
  });
});
