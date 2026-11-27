import { describe, expect, it } from "vitest";
import type { StatsItem } from "../api";
import {
  DEFAULT_CONFIG,
  businessDaysBetween,
  equity,
  newState,
  runBot,
  sessionIncomplete,
  shouldAutoRun,
  summarize,
  type BotState,
} from "./engine";

const T = "2026-11-26"; // Perşembe
// AL: trend yukarı (sma20>sma50), fiyat>sma20, RSI nötr, hacim ortalamanın üstünde
const al = (symbol: string, price = 110, o: Partial<StatsItem> = {}): StatsItem => ({
  symbol, price, prevClose: price, volume: 2000, avgVolume: 1000, vol: 0.3, rsi: 50, sma20: price * 0.95, sma50: price * 0.9, ...o,
});
// SAT: trend aşağı, fiyat<sma20
const sat = (symbol: string, price = 100): StatsItem => ({
  symbol, price, prevClose: price, volume: 1000, avgVolume: 1000, vol: 0.3, rsi: 50, sma20: price * 1.05, sma50: price * 1.1,
});
// TUT: oylar dengede
const tut = (symbol: string, price = 100): StatsItem => ({
  symbol, price, prevClose: price, volume: 1000, avgVolume: 1000, vol: 0.3, rsi: 50, sma20: price * 0.99, sma50: price * 1.0,
});

const withPos = (s: BotState, symbol: string, qty: number, buyPrice: number, buyDate = "2026-11-24"): BotState => ({
  ...s,
  cash: s.cash - qty * buyPrice,
  positions: [...s.positions, { symbol, qty, buyPrice, buyDate, buyFee: 0 }],
});
const fresh = () => newState(DEFAULT_CONFIG, "2026-11-20");

describe("bot motoru: hesap ve alış", () => {
  it("varsayılan: 150.000 TL nakit, işlem başı 15.000 TL, en fazla 10 pozisyon", () => {
    const s = fresh();
    expect(s.cash).toBe(150_000);
    expect(DEFAULT_CONFIG.perTrade).toBe(15_000);
    expect(DEFAULT_CONFIG.maxPositions).toBe(10);
    expect(s.positions).toEqual([]);
  });

  it("AL sinyalinde komisyon dahil 15.000 TL'yi aşmayan en büyük lot alınır: floor(15.000 / (fiyat × 1,001))", () => {
    const { state, bought } = runBot(fresh(), [al("AAA", 40)], T);
    expect(bought).toEqual(["AAA"]);
    expect(state.positions[0]).toMatchObject({ symbol: "AAA", qty: 374, buyPrice: 40, buyDate: T });
    expect(state.positions[0].buyFee).toBeCloseTo(374 * 40 * 0.001, 6);
    expect(state.cash).toBeCloseTo(150_000 - 374 * 40 * 1.001, 6);
  });

  it("lot aşağı yuvarlanır: 400 TL hisseden 37 adet (14.800 TL)", () => {
    const { state } = runBot(fresh(), [al("AAA", 400)], T);
    expect(state.positions[0].qty).toBe(37);
  });

  it("fiyatı işlem tutarından büyük hisse (lot 0) alınmaz", () => {
    const { state } = runBot(fresh(), [al("AAA", 20_000)], T);
    expect(state.positions).toHaveLength(0);
  });

  it("AL olmayan (TUT / SAT) hisse alınmaz", () => {
    const { state } = runBot(fresh(), [tut("AAA"), sat("BBB")], T);
    expect(state.positions).toHaveLength(0);
  });

  it("RSI ≥ 70 ise alınmaz; RSI verisi yoksa da alınmaz", () => {
    const { state } = runBot(fresh(), [al("AAA", 110, { rsi: 70 }), al("BBB", 110, { rsi: null })], T);
    expect(state.positions).toHaveLength(0);
  });

  it("hacim ortalamanın altındaysa alınmaz; filtre kapalıysa alınır", () => {
    const low = al("AAA", 110, { volume: 500, avgVolume: 1000 });
    expect(runBot(fresh(), [low], T).state.positions).toHaveLength(0);
    const off = newState({ ...DEFAULT_CONFIG, requireVolume: false }, "2026-11-20");
    expect(runBot(off, [low], T).state.positions).toHaveLength(1);
  });

  it("zaten portföydeki hisse tekrar alınmaz", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    const { state, bought } = runBot(s, [al("AAA", 105)], T); // +%5: ne zarar durdur ne kâr al
    expect(bought).toEqual([]);
    expect(state.positions).toHaveLength(1);
  });

  it("en fazla 10 pozisyon: adaylar skora göre, eşitse kod sırasına göre dizilir", () => {
    const stats = ["K", "J", "I", "H", "G", "F", "E", "D", "C", "B", "A"].map((s) => al(`S${s}`, 110));
    const { state, bought } = runBot(fresh(), stats, T);
    expect(state.positions).toHaveLength(10);
    expect(bought).toEqual(["SA", "SB", "SC", "SD", "SE", "SF", "SG", "SH", "SI", "SJ"]);
  });

  it("yüksek skorlu aday önce alınır (3/3 oy, 2/3 oydan önce)", () => {
    const strong = al("ZZZ", 110, { rsi: 25 }); // +3
    const normal = al("AAA", 110); // +2
    const cfg = newState({ ...DEFAULT_CONFIG, maxPositions: 1, rsiMax: 70 }, "2026-11-20");
    expect(runBot(cfg, [normal, strong], T).bought).toEqual(["ZZZ"]);
  });

  it("nakit yetmezse almaz", () => {
    const s = { ...fresh(), cash: 10_000 };
    expect(runBot(s, [al("AAA", 110)], T).state.positions).toHaveLength(0);
  });

  it("fiyatı olmayan hisse atlanır", () => {
    const { state } = runBot(fresh(), [al("AAA", 110, { price: null })], T);
    expect(state.positions).toHaveLength(0);
  });
});

describe("bot motoru: satış", () => {
  it("%5 zararda 'Zarar durdur' ile satar", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    const { state, sold } = runBot(s, [tut("AAA", 95)], T);
    expect(sold[0].reason).toBe("Zarar durdur");
    expect(state.positions).toHaveLength(0);
  });

  it("%10 kârda 'Kâr al' ile satar", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    expect(runBot(s, [tut("AAA", 110)], T).sold[0].reason).toBe("Kâr al");
  });

  it("sinyal SAT olunca satar", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    expect(runBot(s, [sat("AAA", 101)], T).sold[0].reason).toBe("SAT sinyali");
  });

  it("20 işlem günü dolunca satar (hafta sonu sayılmaz)", () => {
    const s = withPos(fresh(), "AAA", 100, 100, "2026-10-29"); // 20 iş günü sonra 2026-11-26
    expect(businessDaysBetween("2026-10-29", T)).toBe(20);
    expect(runBot(s, [tut("AAA", 100)], T).sold[0].reason).toBe("Süre doldu");
    const young = withPos(fresh(), "AAA", 100, 100, "2026-10-30");
    expect(runBot(young, [tut("AAA", 100)], T).sold).toHaveLength(0);
  });

  it("birden çok koşul varsa öncelik: zarar durdur > kâr al > SAT sinyali > süre", () => {
    const s = withPos(fresh(), "AAA", 100, 100, "2026-10-01");
    expect(runBot(s, [sat("AAA", 90)], T).sold[0].reason).toBe("Zarar durdur");
  });

  it("kâr/zarar komisyonlar düşülerek hesaplanır, nakit güncellenir", () => {
    const bought = runBot(fresh(), [al("AAA", 40)], "2026-11-24").state; // 374 adet @40
    const { state, sold } = runBot(bought, [tut("AAA", 44)], T); // %10 kâr → sat
    const buyFee = 374 * 40 * 0.001;
    const sellFee = 374 * 44 * 0.001;
    const pnl = 374 * 44 - 374 * 40 - buyFee - sellFee; // komisyonlar düşülmüş net kâr
    expect(sold[0].pnl).toBeCloseTo(pnl, 6);
    expect(sold[0].pnlPct).toBeCloseTo((pnl / (374 * 40)) * 100, 6);
    expect(state.cash).toBeCloseTo(150_000 - 374 * 40 - buyFee + 374 * 44 - sellFee, 6);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0]).toMatchObject({ symbol: "AAA", sellDate: T, buyDate: "2026-11-24" });
  });

  it("fiyatı gelmeyen elde tutulan hisse satılmaz", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    expect(runBot(s, [tut("AAA", 100), { ...tut("AAA"), price: null }].slice(1), T).state.positions).toHaveLength(1);
  });

  it("aynı gün satılan hisse aynı çalıştırmada yeniden alınmaz", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    const stats = [{ ...al("AAA", 89) }]; // zarar durdurur ama AL sinyali verir
    const { state, sold, bought } = runBot(s, stats, T);
    expect(sold).toHaveLength(1);
    expect(bought).toEqual([]);
    expect(state.positions).toHaveLength(0);
  });

  it("önce satar, sonra alır: boşalan nakit ve yer aynı turda kullanılır", () => {
    const s = withPos(fresh(), "OLD", 200, 100);
    const r = runBot({ ...s, cash: 100 }, [sat("OLD", 100), al("NEW", 110)], T);
    expect(r.sold).toHaveLength(1);
    expect(r.bought).toEqual(["NEW"]);
  });

  it("girdi durumunu değiştirmez ve çalışma gününü kaydeder", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    const snap = JSON.stringify(s);
    const { state } = runBot(s, [sat("AAA")], T);
    expect(JSON.stringify(s)).toBe(snap);
    expect(state.lastRunDate).toBe(T);
  });
});

describe("bot motoru: özet ve zamanlama", () => {
  it("toplam değer = nakit + pozisyonların güncel değeri (fiyat yoksa alış fiyatı)", () => {
    const s = withPos(withPos(fresh(), "AAA", 100, 100), "BBB", 10, 50);
    expect(equity(s, [tut("AAA", 120)])).toBe(s.cash + 100 * 120 + 10 * 50);
  });

  it("özet: kâr/zarar TL ve %, kapanan işlem sayısı, kazanma oranı", () => {
    let s = fresh();
    s = runBot(s, [al("AAA", 40)], "2026-11-24").state;
    s = runBot(s, [tut("AAA", 44)], T).state; // kârlı kapanış
    const sum = summarize(s, []);
    expect(sum.closed).toBe(1);
    expect(sum.wins).toBe(1);
    expect(sum.winRate).toBe(100);
    const pnl = 374 * 4 - 374 * 40 * 0.001 - 374 * 44 * 0.001;
    expect(sum.pnl).toBeCloseTo(pnl, 6);
    expect(sum.pnlPct).toBeCloseTo((pnl / 150_000) * 100, 6);
    expect(summarize(fresh(), []).winRate).toBeNull();
  });

  it("iş günü sayımı: Cuma→Pazartesi 1, Pazartesi→Pazartesi 5, aynı gün 0", () => {
    expect(businessDaysBetween("2026-11-27", "2026-11-30")).toBe(1);
    expect(businessDaysBetween("2026-11-23", "2026-11-30")).toBe(5);
    expect(businessDaysBetween("2026-11-23", "2026-11-23")).toBe(0);
  });

  it("otomatik çalışma: iş günü 18:15'ten sonra (TR) ve o gün çalışmadıysa", () => {
    const s = fresh();
    expect(shouldAutoRun(s, new Date("2026-11-26T15:20:00Z"))).toBe(true); // 18:20 TR, Perşembe
    expect(shouldAutoRun(s, new Date("2026-11-26T15:10:00Z"))).toBe(false); // 18:10 TR
    expect(shouldAutoRun(s, new Date("2026-11-28T15:20:00Z"))).toBe(false); // Cumartesi
    expect(shouldAutoRun({ ...s, lastRunDate: T }, new Date("2026-11-26T15:30:00Z"))).toBe(false);
    expect(shouldAutoRun({ ...s, lastRunDate: "2026-11-25" }, new Date("2026-11-26T15:30:00Z"))).toBe(true);
  });
});

describe("bot motoru: gün içi hacim ve tarama özeti", () => {
  it("seans bitmeden (10:00–18:15 TR) hacim henüz tamamlanmamıştır; öncesi, sonrası ve hafta sonu tamdır", () => {
    expect(sessionIncomplete(new Date("2026-11-27T10:21:00Z"))).toBe(true); // 13:21 TR, Cuma
    expect(sessionIncomplete(new Date("2026-11-27T07:00:00Z"))).toBe(true); // 10:00 TR
    expect(sessionIncomplete(new Date("2026-11-27T06:50:00Z"))).toBe(false); // 09:50 TR, açılış öncesi
    expect(sessionIncomplete(new Date("2026-11-27T15:20:00Z"))).toBe(false); // 18:20 TR
    expect(sessionIncomplete(new Date("2026-11-28T10:21:00Z"))).toBe(false); // Cumartesi
  });

  it("seans açıkken (kısmi hacim) hacim filtresi uygulanmaz; kapalıyken uygulanır", () => {
    const low = al("AAA", 110, { volume: 300, avgVolume: 1000 });
    expect(runBot(fresh(), [low], T).bought).toEqual([]);
    const r = runBot(fresh(), [low], T, { sessionOpen: true });
    expect(r.bought).toEqual(["AAA"]);
    expect(r.scan.volumeSkipped).toBe(true);
  });

  it("tarama özeti: toplam, AL sayısı, RSI ve hacimden elenenler, aday ve alınan sayısı", () => {
    const stats = [
      al("OK1", 110), // aday
      al("RSI", 110, { rsi: null }), // RSI verisi yok → elenir
      al("VOL", 110, { volume: 100, avgVolume: 1000 }), // hacim düşük → elenir
      tut("TUT"),
    ];
    const r = runBot(fresh(), stats, T);
    expect(r.scan).toMatchObject({ total: 4, al: 3, rsiOut: 1, volumeOut: 1, candidates: 1, bought: 1, volumeSkipped: false });
    expect(r.state.lastScan).toMatchObject({ date: T, total: 4, al: 3 });
  });

  it("zaten portföyde olan veya aynı gün satılan AL'lar özette 'portföyde' sayılır", () => {
    const s = withPos(fresh(), "AAA", 100, 100);
    const r = runBot(s, [al("AAA", 105)], T);
    expect(r.scan).toMatchObject({ al: 1, held: 1, candidates: 0, bought: 0 });
  });
});
