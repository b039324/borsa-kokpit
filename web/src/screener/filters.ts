import type { StatsItem } from "../api";

export interface FilterOption {
  key: string;
  label: string;
  test: (s: StatsItem) => boolean;
}

export interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

const pctOf = (s: StatsItem): number | null =>
  num(s.price) && num(s.prevClose) && s.prevClose !== 0 ? ((s.price - s.prevClose) * 100) / s.prevClose : null;

const volRatio = (s: StatsItem): number | null =>
  num(s.volume) && num(s.avgVolume) && s.avgVolume > 0 ? s.volume / s.avgVolume : null;

// Eksik veri, aktif bir filtreyi geçemez.
const when = (v: number | null | undefined, f: (n: number) => boolean) => num(v) && f(v);

// Her grupta tek seçenek seçilir; gruplar VE ile birleşir. Eşikler etiketlerde yazılı.
export const GROUPS: FilterGroup[] = [
  {
    key: "rsi",
    label: "RSI (14)",
    options: [
      { key: "low", label: "Aşırı satım (≤ 30)", test: (s) => when(s.rsi, (r) => r <= 30) },
      { key: "high", label: "Aşırı alım (≥ 70)", test: (s) => when(s.rsi, (r) => r >= 70) },
    ],
  },
  {
    key: "sma50",
    label: "Fiyat / 50 günlük ortalama",
    options: [
      { key: "above", label: "Üstünde", test: (s) => num(s.price) && when(s.sma50, (m) => s.price! > m) },
      { key: "below", label: "Altında", test: (s) => num(s.price) && when(s.sma50, (m) => s.price! < m) },
    ],
  },
  {
    key: "trend",
    label: "Trend (20 / 50 günlük)",
    options: [
      { key: "up", label: "Yükselen (20 > 50)", test: (s) => num(s.sma20) && when(s.sma50, (m) => s.sma20! > m) },
      { key: "down", label: "Düşen (20 < 50)", test: (s) => num(s.sma20) && when(s.sma50, (m) => s.sma20! < m) },
    ],
  },
  {
    key: "range",
    label: "3 aylık aralık",
    options: [
      { key: "high", label: "Zirveye yakın (≥ %95)", test: (s) => when(s.rangePos, (p) => p >= 0.95) },
      { key: "low", label: "Dibe yakın (≤ %5)", test: (s) => when(s.rangePos, (p) => p <= 0.05) },
    ],
  },
  {
    key: "day",
    label: "Günlük değişim",
    options: [
      { key: "up", label: "≥ +%3", test: (s) => when(pctOf(s), (p) => p >= 3) },
      { key: "down", label: "≤ −%3", test: (s) => when(pctOf(s), (p) => p <= -3) },
    ],
  },
  {
    key: "volume",
    label: "Hacim",
    options: [{ key: "spike", label: "Ortalamasının ≥ 2 katı", test: (s) => when(volRatio(s), (r) => r >= 2) }],
  },
  {
    key: "vol",
    label: "Oynaklık (yıllık)",
    options: [
      { key: "low", label: "Düşük (≤ %30)", test: (s) => when(s.vol, (v) => v <= 0.3) },
      { key: "high", label: "Yüksek (≥ %60)", test: (s) => when(s.vol, (v) => v >= 0.6) },
    ],
  },
];

export interface ScreenRow {
  symbol: string;
  price: number;
  pct: number | null;
  rsi: number | null;
  ratio: number | null; // hacim / ortalama
}

// selection: grup anahtarı → seçenek anahtarı ("" ya da bilinmeyen = fark etmez).
export function applyFilters(items: StatsItem[], selection: Record<string, string>): ScreenRow[] {
  const active: FilterOption[] = [];
  for (const g of GROUPS) {
    const opt = g.options.find((o) => o.key === selection[g.key]);
    if (opt) active.push(opt);
  }
  const rows: ScreenRow[] = [];
  for (const s of items) {
    if (!num(s.price)) continue;
    if (!active.every((o) => o.test(s))) continue;
    rows.push({ symbol: s.symbol, price: s.price, pct: pctOf(s), rsi: num(s.rsi) ? s.rsi : null, ratio: volRatio(s) });
  }
  return rows.sort((a, b) => {
    if (a.pct === null && b.pct === null) return a.symbol.localeCompare(b.symbol);
    if (a.pct === null) return 1;
    if (b.pct === null) return -1;
    return b.pct - a.pct || a.symbol.localeCompare(b.symbol);
  });
}
