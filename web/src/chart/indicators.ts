// Basit hareketli ortalama. İlk n-1 değer null (yeterli veri yok).
export function sma(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

// Üstel hareketli ortalama. İlk değer, ilk n değerin basit ortalamasıyla başlar.
export function ema(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (values.length < n) return out;
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  const k = 2 / (n + 1);
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// Wilder RSI. İlk n değişimin ortalamasıyla başlar; hareket hiç yoksa 50.
export function rsi(closes: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = closes.map(() => null);
  if (closes.length <= n) return out;
  const toRsi = (g: number, l: number) => (g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l));
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = toRsi(gain, loss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = toRsi(gain, loss);
  }
  return out;
}

export interface Macd {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
}

export function macd(closes: number[], fast = 12, slow = 26, sig = 9): Macd {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => (f[i] !== null && s[i] !== null ? f[i]! - s[i]! : null));
  const first = line.findIndex((v) => v !== null);
  const signal: (number | null)[] = closes.map(() => null);
  if (first >= 0) {
    const part = ema(line.slice(first) as number[], sig);
    part.forEach((v, j) => (signal[first + j] = v));
  }
  const hist = line.map((v, i) => (v !== null && signal[i] !== null ? v - signal[i]! : null));
  return { macd: line, signal, hist };
}

export interface Bands {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

// Bollinger bantları: orta = n günlük SMA, bantlar = ±k × popülasyon standart sapması.
export function bollinger(closes: number[], n = 20, k = 2): Bands {
  const mid = sma(closes, n);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const m = mid[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let ss = 0;
    for (let j = i - n + 1; j <= i; j++) ss += (closes[j] - m) ** 2;
    const sd = Math.sqrt(ss / n);
    upper.push(m + k * sd);
    lower.push(m - k * sd);
  }
  return { mid, upper, lower };
}

type Bar = { h: number; l: number; c: number };

// Wilder ATR. Gerçek aralık = max(h-l, |h-öncekiKapanış|, |l-öncekiKapanış|); ilk mumda h-l.
// İlk ATR (n-1. indeks) ilk n gerçek aralığın ortalaması, sonrası Wilder yumuşatması.
export function atr(candles: Bar[], n = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let prev = 0;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tr = i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c));
    if (i < n - 1) {
      sum += tr;
      out.push(null);
    } else if (i === n - 1) {
      sum += tr;
      prev = sum / n;
      out.push(prev);
    } else {
      prev = (prev * (n - 1) + tr) / n;
      out.push(prev);
    }
  }
  return out;
}

// Boşlukları (null) atlayarak basit ortalama; pencerede null varsa null.
function smaNullable(values: (number | null)[], n: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < n - 1) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const v = values[j];
      if (v === null) return null;
      s += v;
    }
    return s / n;
  });
}

export interface Stoch {
  k: (number | null)[];
  d: (number | null)[];
}

// Yavaş Stochastic (n, smoothK, d): ham %K = (kapanış - en düşük) / (en yüksek - en düşük) × 100
// (aralık 0 ise 50), %K = ham %K'nın smoothK günlük SMA'sı, %D = %K'nın d günlük SMA'sı.
export function stochastic(candles: Bar[], n = 14, smoothK = 3, d = 3): Stoch {
  const raw: (number | null)[] = candles.map((c, i) => {
    if (i < n - 1) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].h);
      lo = Math.min(lo, candles[j].l);
    }
    return hi > lo ? ((c.c - lo) / (hi - lo)) * 100 : 50;
  });
  const k = smoothK > 1 ? smaNullable(raw, smoothK) : raw;
  return { k, d: smaNullable(k, d) };
}
