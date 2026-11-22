import { describe, expect, it } from "vitest";
import { signalFromStats } from "./stats-signal";
import type { StatsItem } from "../api";

const item = (o: Partial<StatsItem>): StatsItem => ({
  symbol: "X", price: 100, prevClose: 99, volume: null, avgVolume: null, vol: null, ...o,
});

describe("signalFromStats (istatistik özetinden yaklaşık sinyal)", () => {
  it("trend + fiyat + RSI aşırı satım → AL (3/3 oy)", () => {
    const r = signalFromStats(item({ price: 110, sma20: 105, sma50: 100, rsi: 25 }));
    expect(r.verdict).toBe("AL");
    expect(r.score).toBe(3);
    expect(r.voters).toBe(3);
  });

  it("trend aşağı + fiyat SMA20 altında + RSI aşırı alım → SAT", () => {
    const r = signalFromStats(item({ price: 90, sma20: 95, sma50: 100, rsi: 75 }));
    expect(r.verdict).toBe("SAT");
    expect(r.score).toBe(-3);
  });

  it("oylar dengeliyse TUT: trend ve fiyat aşağı (-2) ama RSI aşırı satım (+1) → -1", () => {
    const t = signalFromStats(item({ price: 90, sma20: 95, sma50: 100, rsi: 25 }));
    expect(t.score).toBe(-1);
    expect(t.verdict).toBe("TUT");
  });

  it("eşik tek göstergede değil, AL ≥ +2 ve SAT ≤ -2'de", () => {
    expect(signalFromStats(item({ price: 110, sma20: 105, sma50: 100, rsi: 50 })).verdict).toBe("AL");
    expect(signalFromStats(item({ price: 90, sma20: 95, sma50: 100, rsi: 50 })).verdict).toBe("SAT");
  });

  it("eksik veri: yalnız 1 gösterge oy verirse YETERSİZ", () => {
    const r = signalFromStats(item({ price: 100, rsi: 25 }));
    expect(r.voters).toBe(1);
    expect(r.verdict).toBe("YETERSİZ");
  });

  it("hiç veri yoksa YETERSİZ, oy 0", () => {
    const r = signalFromStats(item({ price: null }));
    expect(r.verdict).toBe("YETERSİZ");
    expect(r.voters).toBe(0);
  });

  it("eski Worker sürümü (rsi/sma alanları yok) çökmez", () => {
    expect(() => signalFromStats({ symbol: "X", price: 5, prevClose: 5, volume: null, avgVolume: null, vol: null })).not.toThrow();
  });
});
