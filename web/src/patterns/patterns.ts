import type { Candle } from "../api";

export type PatternDir = "bullish" | "bearish" | "neutral";

export interface Pattern {
  id: string;
  name: string;
  dir: PatternDir;
  desc: string;
  index: number; // formasyonu tamamlayan mumun indeksi
  t: number; // o mumun zamanı (sn)
}

// Eşikler (tek yerde): gövde/menzil oranları, fitil oranları.
const DOJI_MAX = 0.1; // gövde ≤ menzilin %10'u
const MARUBOZU_MIN = 0.9; // gövde ≥ menzilin %90'ı
const LONG_BODY_MIN = 0.5; // "uzun" gövde: menzilin en az yarısı
const SMALL_BODY_MAX = 0.3; // yıldız mumu: önceki gövdenin en çok %30'u
const LONG_SHADOW = 2; // uzun fitil ≥ 2 × gövde
const SHORT_SHADOW_MAX = 0.15; // karşı fitil ≤ menzilin %15'i

const body = (c: Candle) => Math.abs(c.c - c.o);
const range = (c: Candle) => c.h - c.l;
const upper = (c: Candle) => c.h - Math.max(c.o, c.c);
const lower = (c: Candle) => Math.min(c.o, c.c) - c.l;
const bull = (c: Candle) => c.c > c.o;
const bear = (c: Candle) => c.c < c.o;
const valid = (c: Candle) => range(c) > 0;
const mid = (c: Candle) => (c.o + c.c) / 2;
const longBody = (c: Candle) => body(c) >= LONG_BODY_MIN * range(c);

// Önceki 3 mumun eğilimi: son kapanış 3 mum öncekinden yüksekse +1, düşükse -1, değilse 0.
function trend(cs: Candle[], i: number): number {
  if (i < 3) return 0;
  return Math.sign(cs[i - 1].c - cs[i - 3].c);
}

function single(cs: Candle[], i: number): Omit<Pattern, "index" | "t">[] {
  const c = cs[i];
  if (!valid(c)) return [];
  const out: Omit<Pattern, "index" | "t">[] = [];
  const ratio = body(c) / range(c);
  if (ratio <= DOJI_MAX) {
    out.push({ id: "doji", name: "Doji", dir: "neutral", desc: "Açılış ve kapanış neredeyse aynı; alıcı-satıcı kararsız." });
    return out;
  }
  if (ratio >= MARUBOZU_MIN) {
    out.push(
      bull(c)
        ? { id: "bullish-marubozu", name: "Boğa marubozu", dir: "bullish", desc: "Neredeyse fitilsiz güçlü yeşil mum; gün boyu alıcı baskın." }
        : { id: "bearish-marubozu", name: "Ayı marubozu", dir: "bearish", desc: "Neredeyse fitilsiz güçlü kırmızı mum; gün boyu satıcı baskın." },
    );
  }
  const t = trend(cs, i);
  if (t !== 0) {
    if (lower(c) >= LONG_SHADOW * body(c) && upper(c) <= SHORT_SHADOW_MAX * range(c)) {
      out.push(
        t < 0
          ? { id: "hammer", name: "Çekiç", dir: "bullish", desc: "Düşüş sonrası uzun alt fitil: satış baskısı geri alındı, dönüş ihtimali." }
          : { id: "hanging-man", name: "Asılı adam", dir: "bearish", desc: "Yükseliş sonrası uzun alt fitil: alıcılar zayıflıyor olabilir." },
      );
    }
    if (upper(c) >= LONG_SHADOW * body(c) && lower(c) <= SHORT_SHADOW_MAX * range(c)) {
      out.push(
        t < 0
          ? { id: "inverted-hammer", name: "Ters çekiç", dir: "bullish", desc: "Düşüş sonrası uzun üst fitil: alıcılar denemeye başladı, teyit gerekir." }
          : { id: "shooting-star", name: "Kayan yıldız", dir: "bearish", desc: "Yükseliş sonrası uzun üst fitil: yükseliş reddedildi." },
      );
    }
  }
  return out;
}

function double(cs: Candle[], i: number): Omit<Pattern, "index" | "t">[] {
  if (i < 1) return [];
  const p = cs[i - 1];
  const c = cs[i];
  if (!valid(p) || !valid(c)) return [];
  const out: Omit<Pattern, "index" | "t">[] = [];
  if (bear(p) && bull(c) && c.o <= p.c && c.c >= p.o && body(c) > body(p)) {
    out.push({ id: "bullish-engulfing", name: "Yutan boğa", dir: "bullish", desc: "Yeşil mum önceki kırmızı mumun gövdesini tamamen yuttu." });
  }
  if (bull(p) && bear(c) && c.o >= p.c && c.c <= p.o && body(c) > body(p)) {
    out.push({ id: "bearish-engulfing", name: "Yutan ayı", dir: "bearish", desc: "Kırmızı mum önceki yeşil mumun gövdesini tamamen yuttu." });
  }
  if (bear(p) && longBody(p) && bull(c) && c.o < p.c && c.c > mid(p) && c.c < p.o) {
    out.push({ id: "piercing", name: "Delici hat", dir: "bullish", desc: "Aşağıdan açılıp önceki kırmızı gövdenin yarısının üstünde kapandı." });
  }
  if (bull(p) && longBody(p) && bear(c) && c.o > p.c && c.c < mid(p) && c.c > p.o) {
    out.push({ id: "dark-cloud", name: "Kara bulut örtüsü", dir: "bearish", desc: "Yukarıdan açılıp önceki yeşil gövdenin yarısının altında kapandı." });
  }
  return out;
}

function triple(cs: Candle[], i: number): Omit<Pattern, "index" | "t">[] {
  if (i < 2) return [];
  const a = cs[i - 2];
  const b = cs[i - 1];
  const c = cs[i];
  if (!valid(a) || !valid(b) || !valid(c)) return [];
  const out: Omit<Pattern, "index" | "t">[] = [];
  const small = body(b) <= SMALL_BODY_MAX * body(a);
  if (bear(a) && longBody(a) && small && bull(c) && c.c > mid(a)) {
    out.push({ id: "morning-star", name: "Sabah yıldızı", dir: "bullish", desc: "Uzun kırmızı, küçük gövdeli mum, ardından güçlü yeşil: düşüş yorulmuş olabilir." });
  }
  if (bull(a) && longBody(a) && small && bear(c) && c.c < mid(a)) {
    out.push({ id: "evening-star", name: "Akşam yıldızı", dir: "bearish", desc: "Uzun yeşil, küçük gövdeli mum, ardından güçlü kırmızı: yükseliş yorulmuş olabilir." });
  }
  const soldiers =
    [a, b, c].every((x) => bull(x) && longBody(x)) &&
    b.c > a.c && c.c > b.c &&
    b.o >= a.o && b.o <= a.c &&
    c.o >= b.o && c.o <= b.c;
  if (soldiers) {
    out.push({ id: "three-white-soldiers", name: "Üç beyaz asker", dir: "bullish", desc: "Üst üste üç güçlü yeşil mum, her biri öncekinden yüksek kapandı." });
  }
  const crows =
    [a, b, c].every((x) => bear(x) && longBody(x)) &&
    b.c < a.c && c.c < b.c &&
    b.o <= a.o && b.o >= a.c &&
    c.o <= b.o && c.o >= b.c;
  if (crows) {
    out.push({ id: "three-black-crows", name: "Üç kara karga", dir: "bearish", desc: "Üst üste üç güçlü kırmızı mum, her biri öncekinden düşük kapandı." });
  }
  return out;
}

// Son `lookback` mumda tamamlanan formasyonlar; en yeni başta.
export function detectPatterns(candles: Candle[], lookback = 10): Pattern[] {
  const out: Pattern[] = [];
  for (let i = candles.length - 1; i >= Math.max(0, candles.length - lookback); i--) {
    for (const p of [...single(candles, i), ...double(candles, i), ...triple(candles, i)]) {
      out.push({ ...p, index: i, t: candles[i].t });
    }
  }
  return out;
}
