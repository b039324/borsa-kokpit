import { macd, rsi, sma } from "../chart/indicators";

// SİNYAL KURALI — değiştirmek için yalnız bu dosyaya dokun.
// 4 gösterge oy verir: +1 (al yönlü), -1 (sat yönlü), 0 (nötr). Veri yetmeyen gösterge oy kullanmaz.
// Toplam >= +2 → AL, <= -2 → SAT, aksi halde TUT. Bilgi amaçlıdır, tavsiye değildir.
export const BUY_AT = 2;
export const SELL_AT = -2;

export type Vote = 1 | 0 | -1;
export type Verdict = "AL" | "SAT" | "TUT" | "YETERSİZ";

export interface Reason {
  key: "trend" | "fiyat" | "rsi" | "macd";
  label: string;
  vote: Vote;
  detail: string;
}

export interface SignalResult {
  verdict: Verdict;
  score: number;
  voters: number;
  reasons: Reason[];
}

const f = (n: number, d = 2) => n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
const last = <T,>(a: (T | null)[]): T | null => (a.length ? a[a.length - 1] : null);

export function computeSignal(closes: number[]): SignalResult {
  const reasons: Reason[] = [];
  const price = closes.length ? closes[closes.length - 1] : null;
  const s21 = last(sma(closes, 21));
  const s50 = last(sma(closes, 50));

  if (s21 !== null && s50 !== null) {
    const vote: Vote = s21 > s50 ? 1 : s21 < s50 ? -1 : 0;
    reasons.push({
      key: "trend", label: "Trend (SMA 21 / SMA 50)", vote,
      detail: `SMA 21 ${f(s21)} ${vote > 0 ? "üstünde" : vote < 0 ? "altında" : "eşit"} SMA 50 ${f(s50)}`,
    });
  }

  if (price !== null && s21 !== null) {
    const vote: Vote = price > s21 ? 1 : price < s21 ? -1 : 0;
    reasons.push({
      key: "fiyat", label: "Fiyat / SMA 21", vote,
      detail: `Fiyat ${f(price)}, SMA 21 ${f(s21)} ${vote > 0 ? "üstünde" : vote < 0 ? "altında" : "üzerinde"}`,
    });
  }

  const r = last(rsi(closes, 14));
  if (r !== null) {
    // Aşırı satım dönüş ihtimali (al yönlü), aşırı alım düzeltme ihtimali (sat yönlü) sayılır.
    const vote: Vote = r <= 30 ? 1 : r >= 70 ? -1 : 0;
    reasons.push({
      key: "rsi", label: "RSI (14)", vote,
      detail: `RSI ${f(r, 1)} — ${r <= 30 ? "aşırı satım" : r >= 70 ? "aşırı alım" : "nötr bölge"}`,
    });
  }

  const m = last(macd(closes).hist);
  if (m !== null) {
    const h = Math.round(m * 1000) / 1000; // gürültüyü yok say
    const vote: Vote = h > 0 ? 1 : h < 0 ? -1 : 0;
    reasons.push({
      key: "macd", label: "MACD histogram", vote,
      detail: `Histogram ${f(m, 3)} — ${vote > 0 ? "pozitif" : vote < 0 ? "negatif" : "sıfıra yakın"}`,
    });
  }

  const voters = reasons.length;
  const score = reasons.reduce((s, x) => s + x.vote, 0);
  // En az 2 gösterge oy kullanmadıysa karar verme.
  const verdict: Verdict = voters < 2 ? "YETERSİZ" : score >= BUY_AT ? "AL" : score <= SELL_AT ? "SAT" : "TUT";
  return { verdict, score, voters, reasons };
}
