import type { Candle } from "../api";

const DAY = 86400;
const MAX_GAP_DAYS = 7;

export interface Pair {
  t: number; // A mumunun zamanı
  a: number;
  b: number;
}

const dayKey = (t: number, off: number) => Math.floor((t + off) / DAY);

// A serisinin her mumu için, aynı gün ya da ondan önceki son B kapanışını eşler.
// Tatil/hafta sonu farkları böylece kapanır. Her serinin kendi saat dilimi farkı (sn) kullanılır.
export function alignAsOf(a: Candle[], aOff: number, b: Candle[], bOff: number): Pair[] {
  const out: Pair[] = [];
  let j = -1;
  for (const ca of a) {
    const day = dayKey(ca.t, aOff);
    while (j + 1 < b.length && dayKey(b[j + 1].t, bOff) <= day) j++;
    if (j < 0) continue;
    if (day - dayKey(b[j].t, bOff) > MAX_GAP_DAYS) continue;
    out.push({ t: ca.t, a: ca.c, b: b[j].c });
  }
  return out;
}

// İlk değeri `base` (varsayılan 100) olacak şekilde ölçekler.
export function rebase(values: number[], base = 100): number[] {
  if (values.length === 0 || !(values[0] > 0)) return [];
  const first = values[0];
  return values.map((v) => (v * base) / first);
}

// A/B oranının 100'e çekilmiş hâli: yükseliyorsa A, B'ye göre güçleniyor.
export function ratioSeries(pairs: Pair[]): number[] {
  return rebase(pairs.map((p) => p.a / p.b));
}

export function totalReturn(values: number[]): number | null {
  if (values.length < 2 || !(values[0] > 0)) return null;
  return values[values.length - 1] / values[0] - 1;
}
