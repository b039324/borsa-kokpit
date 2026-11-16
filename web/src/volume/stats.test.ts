import { describe, expect, it } from "vitest";
import { tlOf, volumeStats } from "./stats";

const c = (close: number, v: number) => ({ t: 0, o: close, h: close, l: close, c: close, v });
const days = (n: number, tl = 1000) => Array.from({ length: n }, () => c(10, tl / 10));

describe("volumeStats", () => {
  it("tlOf kapanış × lot", () => expect(tlOf(c(12, 5))).toBe(60));

  it("bugünkü TL ve lot toplanır", () => {
    const s = volumeStats([c(10, 100), c(20, 50)], days(30));
    expect(s.todayTL).toBe(10 * 100 + 20 * 50);
    expect(s.todayLot).toBe(150);
  });

  it("ortalama son 20 günden hesaplanır, son gün (bugün) hariç", () => {
    const hist = [...days(25, 1000), c(10, 1_000_000)]; // son mum çok büyük ama hariç tutulmalı
    const s = volumeStats([c(10, 300)], hist);
    expect(s.days).toBe(20);
    expect(s.avgDailyTL).toBe(1000);
    expect(s.ratio).toBe(3); // 3000 / 1000
  });

  it("6 günlük veride 5 gün ortalamaya girer", () => {
    expect(volumeStats([c(10, 1)], days(6)).days).toBe(5);
  });

  it("5 günden az geçmişte ortalama ve oran yok", () => {
    const s = volumeStats([c(10, 100)], days(5)); // 5 mum → 4 gün (son hariç)
    expect(s.avgDailyTL).toBeNull();
    expect(s.ratio).toBeNull();
  });

  it("geçmiş hacim sıfırsa oran yok (sıfıra bölme)", () => {
    const s = volumeStats([c(10, 100)], days(30, 0));
    expect(s.ratio).toBeNull();
  });

  it("boş girdide çökmez", () => {
    const s = volumeStats([], []);
    expect(s.todayTL).toBe(0);
    expect(s.ratio).toBeNull();
  });
});
