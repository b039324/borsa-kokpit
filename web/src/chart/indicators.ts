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
