import { describe, expect, it } from "vitest";
import { computeSignal } from "./signal";

const accelUp = Array.from({ length: 80 }, (_, i) => 100 + i * i * 0.05);
const accelDown = Array.from({ length: 80 }, (_, i) => 300 - i * i * 0.05);
const flat = Array(80).fill(100);
const byKey = (r: ReturnType<typeof computeSignal>, k: string) => r.reasons.find((x) => x.key === k);

describe("computeSignal", () => {
  it("hızlanan yükselişte: trend, fiyat, MACD +1, RSI aşırı alım −1 → toplam +2 → AL", () => {
    const r = computeSignal(accelUp);
    expect(byKey(r, "trend")!.vote).toBe(1);
    expect(byKey(r, "fiyat")!.vote).toBe(1);
    expect(byKey(r, "macd")!.vote).toBe(1);
    expect(byKey(r, "rsi")!.vote).toBe(-1);
    expect(r.score).toBe(2);
    expect(r.verdict).toBe("AL");
    expect(r.voters).toBe(4);
  });

  it("hızlanan düşüşte: trend, fiyat, MACD −1, RSI aşırı satım +1 → toplam −2 → SAT", () => {
    const r = computeSignal(accelDown);
    expect(r.score).toBe(-2);
    expect(r.verdict).toBe("SAT");
  });

  it("hareketsiz fiyatta hepsi nötr → TUT", () => {
    const r = computeSignal(flat);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe("TUT");
  });

  it("testere dişi yükseliş (+2, −1): RSI ~67 nötr, trend ve fiyat yukarı, MACD ~0 → +2 → AL", () => {
    const saw: number[] = [100];
    for (let i = 1; i < 80; i++) saw.push(saw[i - 1] + (i % 2 ? 2 : -1));
    const r = computeSignal(saw);
    expect(byKey(r, "rsi")!.vote).toBe(0);
    expect(byKey(r, "trend")!.vote).toBe(1);
    expect(byKey(r, "fiyat")!.vote).toBe(1);
    expect(r.verdict).toBe("AL");
  });

  it("50'den az mumda trend oyu yok, 3 gösterge oy verir", () => {
    const r = computeSignal(accelUp.slice(0, 40));
    expect(byKey(r, "trend")).toBeUndefined();
    expect(r.voters).toBe(3);
  });

  it("15'ten az mumda hiçbir gösterge hazır değil → YETERSİZ", () => {
    const r = computeSignal([1, 2, 3, 4, 5]);
    expect(r.verdict).toBe("YETERSİZ");
    expect(r.voters).toBe(0);
  });

  it("tek gösterge oy kullanıyorsa karar vermez (18 mum: yalnız RSI hazır)", () => {
    const r = computeSignal(Array.from({ length: 18 }, (_, i) => 100 + i));
    expect(r.voters).toBe(1);
    expect(r.reasons[0].key).toBe("rsi");
    expect(r.verdict).toBe("YETERSİZ");
  });

  it("boş girdide çökmez", () => {
    expect(computeSignal([]).verdict).toBe("YETERSİZ");
  });

  it("her gerekçenin açıklama metni var", () => {
    for (const x of computeSignal(accelUp).reasons) expect(x.detail.length).toBeGreaterThan(5);
  });
});
