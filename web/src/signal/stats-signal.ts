import type { StatsItem } from "../api";
import { BUY_AT, SELL_AT, type Reason, type SignalResult, type Vote } from "./signal";

// Liste taraması için YAKLAŞIK sinyal: /api/stats özetindeki RSI, SMA20, SMA50 ve fiyattan hesaplanır.
// Tek hisse sinyalinden (signal.ts) farkı: SMA 21 yerine SMA 20, MACD oyu yok (3 gösterge).
// Eşikler aynıdır (AL ≥ +2, SAT ≤ -2); en az 2 gösterge oy kullanmadıysa YETERSİZ.
export function signalFromStats(s: StatsItem): SignalResult {
  const reasons: Reason[] = [];
  const { price, sma20, sma50, rsi } = s;

  if (typeof sma20 === "number" && typeof sma50 === "number") {
    const vote: Vote = sma20 > sma50 ? 1 : sma20 < sma50 ? -1 : 0;
    reasons.push({ key: "trend", label: "Trend (SMA 20 / SMA 50)", vote, detail: "" });
  }
  if (typeof price === "number" && typeof sma20 === "number") {
    const vote: Vote = price > sma20 ? 1 : price < sma20 ? -1 : 0;
    reasons.push({ key: "fiyat", label: "Fiyat / SMA 20", vote, detail: "" });
  }
  if (typeof rsi === "number") {
    const vote: Vote = rsi <= 30 ? 1 : rsi >= 70 ? -1 : 0;
    reasons.push({ key: "rsi", label: "RSI (14)", vote, detail: "" });
  }

  const voters = reasons.length;
  const score = reasons.reduce((t, r) => t + r.vote, 0);
  const verdict = voters < 2 ? "YETERSİZ" : score >= BUY_AT ? "AL" : score <= SELL_AT ? "SAT" : "TUT";
  return { verdict, score, voters, reasons };
}
