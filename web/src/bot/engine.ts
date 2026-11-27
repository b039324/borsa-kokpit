import type { StatsItem } from "../api";
import { signalFromStats } from "../signal/stats-signal";

// AL-SAT BOTU SİMÜLASYONU — gerçek para yok. Kuralları değiştirmek için yalnız bu dosyaya (ve ayar paneline) dokun.
// Alış: sinyal AL + RSI < rsiMax + (hacim ≥ 20 günlük ortalama) + portföyde yok.
// Satış (öncelik sırasıyla): zarar durdur > kâr al > SAT sinyali > süre doldu.
// Komisyon, işlem bütçesinin (perTrade) içindedir: lot = floor(perTrade / (fiyat × (1 + komisyon))).

export interface BotConfig {
  capital: number; // başlangıç nakdi (TL)
  perTrade: number; // işlem başı en fazla kullanım (TL, komisyon dahil)
  maxPositions: number;
  feePct: number; // alış ve satış başına %
  rsiMax: number; // RSI bu değer ve üstündeyse alınmaz
  stopPct: number; // zarar durdur %
  takePct: number; // kâr al %
  maxDays: number; // iş günü
  requireVolume: boolean; // hacim ≥ 20 günlük ortalama şartı
}

export const DEFAULT_CONFIG: BotConfig = {
  capital: 150_000,
  perTrade: 15_000,
  maxPositions: 10,
  feePct: 0.1,
  rsiMax: 70,
  stopPct: 5,
  takePct: 10,
  maxDays: 20,
  requireVolume: true,
};

export type SellReason = "Zarar durdur" | "Kâr al" | "SAT sinyali" | "Süre doldu";

export interface Position {
  symbol: string;
  qty: number;
  buyPrice: number;
  buyDate: string; // YYYY-MM-DD (Türkiye)
  buyFee: number;
}

export interface Trade {
  symbol: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  buyDate: string;
  sellDate: string;
  reason: SellReason;
  pnl: number; // komisyonlar düşülmüş net TL
  pnlPct: number; // alış maliyetine göre %
}

// Son taramanın özeti: "neden almadı"yı göstermek için.
export interface ScanInfo {
  date: string;
  total: number; // değerlendirilen hisse
  al: number; // sinyali AL olanlar
  held: number; // bunlardan zaten portföyde olan / aynı gün satılan
  rsiOut: number; // RSI verisi yok veya sınırın üstünde
  volumeOut: number; // hacim ortalamanın altında
  candidates: number; // tüm filtreleri geçen
  bought: number; // gerçekten alınan (yer/nakit sınırından sonra)
  volumeSkipped: boolean; // seans açıkken hacim filtresi uygulanmadı
}

export interface BotState {
  config: BotConfig;
  cash: number;
  positions: Position[];
  trades: Trade[];
  lastRunDate: string | null;
  startedAt: string;
  lastScan?: ScanInfo;
}

export function newState(config: BotConfig = DEFAULT_CONFIG, startedAt: string): BotState {
  return { config, cash: config.capital, positions: [], trades: [], lastRunDate: null, startedAt };
}

const TR_OFFSET_MS = 3 * 3600_000; // Türkiye saati sabit UTC+3

export function turkeyDay(now: Date): string {
  return new Date(now.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);
}

// from (hariç) → to (dahil) arasındaki hafta içi gün sayısı. Resmî tatiller dahil değil.
export function businessDaysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  let n = 0;
  for (let t = a + 86_400_000; t <= b; t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

// Seans kapanışı 18:00 + 15 dk veri gecikmesi: iş günü 18:15'ten sonra, o gün çalışmadıysa.
export function shouldAutoRun(state: BotState, now: Date): boolean {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  const day = tr.getUTCDay();
  if (day === 0 || day === 6) return false;
  if (tr.getUTCHours() * 60 + tr.getUTCMinutes() < 18 * 60 + 15) return false;
  return state.lastRunDate !== turkeyDay(now);
}

// Seans bitmeden (hafta içi 10:00–18:15 TR) "hacim" günün şimdiye kadarki kısmi hacmidir;
// 20 günlük tam gün ortalamasıyla kıyaslanamaz.
export function sessionIncomplete(now: Date): boolean {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  const day = tr.getUTCDay();
  if (day === 0 || day === 6) return false;
  const min = tr.getUTCHours() * 60 + tr.getUTCMinutes();
  return min >= 10 * 60 && min < 18 * 60 + 15;
}

function sellReason(p: Position, s: StatsItem, price: number, today: string, c: BotConfig): SellReason | null {
  if (price <= (p.buyPrice * (100 - c.stopPct)) / 100) return "Zarar durdur";
  if (price >= (p.buyPrice * (100 + c.takePct)) / 100) return "Kâr al";
  if (signalFromStats(s).verdict === "SAT") return "SAT sinyali";
  if (businessDaysBetween(p.buyDate, today) >= c.maxDays) return "Süre doldu";
  return null;
}

export interface RunResult {
  state: BotState;
  bought: string[];
  sold: Trade[];
  scan: ScanInfo;
}

export interface RunOptions {
  sessionOpen?: boolean; // true: hacim kısmi, filtre uygulanmaz
}

// Bir tarama turu: önce satar (nakit ve yer açılır), sonra alır. Girdi durumu değişmez.
export function runBot(prev: BotState, stats: StatsItem[], today: string, opts: RunOptions = {}): RunResult {
  const c = prev.config;
  const bySym = new Map(stats.map((s) => [s.symbol, s]));
  let cash = prev.cash;
  const positions: Position[] = [];
  const trades = [...prev.trades];
  const sold: Trade[] = [];
  const bought: string[] = [];

  for (const p of prev.positions) {
    const s = bySym.get(p.symbol);
    const price = s?.price;
    const reason = s && typeof price === "number" ? sellReason(p, s, price, today, c) : null;
    if (!s || typeof price !== "number" || !reason) {
      positions.push(p);
      continue;
    }
    const gross = p.qty * price;
    const fee = (gross * c.feePct) / 100;
    cash += gross - fee;
    const pnl = gross - p.qty * p.buyPrice - p.buyFee - fee;
    const t: Trade = {
      symbol: p.symbol, qty: p.qty, buyPrice: p.buyPrice, sellPrice: price,
      buyDate: p.buyDate, sellDate: today, reason, pnl, pnlPct: (pnl / (p.qty * p.buyPrice)) * 100,
    };
    trades.push(t);
    sold.push(t);
  }

  const heldOrSold = new Set([...positions.map((p) => p.symbol), ...sold.map((t) => t.symbol)]);
  const useVolume = c.requireVolume && !opts.sessionOpen;
  let al = 0, held = 0, rsiOut = 0, volumeOut = 0;
  const candidates: { s: StatsItem; sig: ReturnType<typeof signalFromStats> }[] = [];
  for (const s of stats) {
    const sig = signalFromStats(s);
    if (sig.verdict !== "AL" || typeof s.price !== "number" || s.price <= 0) continue;
    al++;
    if (heldOrSold.has(s.symbol)) { held++; continue; }
    if (typeof s.rsi !== "number" || s.rsi >= c.rsiMax) { rsiOut++; continue; }
    if (useVolume && (typeof s.volume !== "number" || typeof s.avgVolume !== "number" || s.volume < s.avgVolume)) { volumeOut++; continue; }
    candidates.push({ s, sig });
  }
  candidates.sort((a, b) => b.sig.score - a.sig.score || a.s.symbol.localeCompare(b.s.symbol));

  for (const { s } of candidates) {
    if (positions.length >= c.maxPositions) break;
    const price = s.price as number;
    const qty = Math.floor(c.perTrade / (price * (1 + c.feePct / 100)));
    if (qty < 1) continue;
    const cost = qty * price;
    const fee = (cost * c.feePct) / 100;
    if (cash < cost + fee) continue;
    cash -= cost + fee;
    positions.push({ symbol: s.symbol, qty, buyPrice: price, buyDate: today, buyFee: fee });
    bought.push(s.symbol);
  }

  const scan: ScanInfo = {
    date: today, total: stats.length, al, held, rsiOut, volumeOut,
    candidates: candidates.length, bought: bought.length, volumeSkipped: c.requireVolume && !!opts.sessionOpen,
  };
  return { state: { ...prev, cash, positions, trades, lastRunDate: today, lastScan: scan }, bought, sold, scan };
}

// Güncel fiyat yoksa alış fiyatıyla değerlenir.
export function equity(state: BotState, stats: StatsItem[]): number {
  const bySym = new Map(stats.map((s) => [s.symbol, s.price]));
  return state.positions.reduce((t, p) => t + p.qty * (bySym.get(p.symbol) ?? p.buyPrice), state.cash);
}

export interface Summary {
  equity: number;
  cash: number;
  invested: number; // açık pozisyonların güncel değeri
  pnl: number; // toplam değer − başlangıç sermayesi
  pnlPct: number;
  closed: number;
  wins: number;
  winRate: number | null; // % (kapanan işlem yoksa null)
}

export function summarize(state: BotState, stats: StatsItem[]): Summary {
  const eq = equity(state, stats);
  const pnl = eq - state.config.capital;
  const wins = state.trades.filter((t) => t.pnl > 0).length;
  const closed = state.trades.length;
  return {
    equity: eq,
    cash: state.cash,
    invested: eq - state.cash,
    pnl,
    pnlPct: (pnl / state.config.capital) * 100,
    closed,
    wins,
    winRate: closed ? (wins / closed) * 100 : null,
  };
}
