import { describe, expect, it } from "vitest";
import { detectPatterns } from "./patterns";

const T0 = 1_700_000_000;
const mk = (o: number, h: number, l: number, c: number, i: number) => ({ t: T0 + i * 86400, o, h, l, c, v: 1 });
// Düz dolgu mumu: küçük ayı mumu, hiçbir formasyon üretmez.
const filler = (c: number, i: number) => mk(c + 0.5, c + 1, c - 1, c, i);
const series = (fillerCloses: number[], ...tail: [number, number, number, number][]) => {
  const out = fillerCloses.map((c, i) => filler(c, i));
  tail.forEach((x, k) => out.push(mk(x[0], x[1], x[2], x[3], fillerCloses.length + k)));
  return out;
};
const find = (cs: ReturnType<typeof series>, id: string) => detectPatterns(cs, 10).find((p) => p.id === id);

describe("tek mum formasyonları", () => {
  it("doji: gövde menzilin %10'u ya da altı", () => {
    const p = find(series([100, 101, 102], [100, 105, 95, 100.5]), "doji");
    expect(p).toMatchObject({ dir: "neutral", name: "Doji", index: 3 });
  });

  it("boğa marubozu", () => {
    const p = find(series([100, 101, 102], [100, 110.2, 99.8, 110]), "bullish-marubozu");
    expect(p).toMatchObject({ dir: "bullish", name: "Boğa marubozu" });
  });

  it("ayı marubozu", () => {
    const p = find(series([100, 101, 102], [110, 110.2, 99.8, 100]), "bearish-marubozu");
    expect(p).toMatchObject({ dir: "bearish", name: "Ayı marubozu" });
  });

  it("çekiç: uzun alt fitil + düşüş eğilimi → yükseliş işareti", () => {
    const p = find(series([110, 108, 106], [100, 101.1, 94, 101]), "hammer");
    expect(p).toMatchObject({ dir: "bullish", name: "Çekiç", index: 3 });
  });

  it("asılı adam: aynı şekil yükseliş eğiliminde → düşüş işareti", () => {
    const cs = series([100, 102, 104], [105, 106.1, 99, 106]);
    expect(find(cs, "hanging-man")).toMatchObject({ dir: "bearish", name: "Asılı adam" });
    expect(find(cs, "hammer")).toBeUndefined();
  });

  it("ters çekiç: uzun üst fitil + düşüş eğilimi → yükseliş işareti", () => {
    const p = find(series([110, 108, 106], [105, 111, 103.9, 104]), "inverted-hammer");
    expect(p).toMatchObject({ dir: "bullish", name: "Ters çekiç" });
  });

  it("kayan yıldız: aynı şekil yükseliş eğiliminde → düşüş işareti", () => {
    const cs = series([100, 102, 104], [105, 111, 103.9, 104]);
    expect(find(cs, "shooting-star")).toMatchObject({ dir: "bearish", name: "Kayan yıldız" });
    expect(find(cs, "inverted-hammer")).toBeUndefined();
  });

  it("eğilim yokken (eşit kapanışlar) çekiç ailesi üretilmez", () => {
    const cs = series([100, 100, 100], [100, 101.1, 94, 101]);
    expect(detectPatterns(cs, 10).map((p) => p.id)).not.toContain("hammer");
    expect(detectPatterns(cs, 10).map((p) => p.id)).not.toContain("hanging-man");
  });
});

describe("iki mum formasyonları", () => {
  it("yutan boğa", () => {
    const cs = series([110, 108, 106], [105, 105.5, 99.5, 100], [99, 106.5, 98.5, 106]);
    expect(find(cs, "bullish-engulfing")).toMatchObject({ dir: "bullish", name: "Yutan boğa", index: 4 });
  });

  it("yutan ayı", () => {
    const cs = series([100, 101, 102], [100, 105.5, 99.5, 105], [106, 106.5, 98.5, 99]);
    expect(find(cs, "bearish-engulfing")).toMatchObject({ dir: "bearish", name: "Yutan ayı" });
  });

  it("delici hat (yutan boğa değil)", () => {
    const cs = series([112, 110, 108], [110, 110.5, 99.5, 100], [98, 106.5, 97.5, 106]);
    expect(find(cs, "piercing")).toMatchObject({ dir: "bullish", name: "Delici hat" });
    expect(find(cs, "bullish-engulfing")).toBeUndefined();
  });

  it("kara bulut örtüsü", () => {
    const cs = series([98, 99, 100], [100, 110.5, 99.5, 110], [112, 112.5, 103.5, 104]);
    expect(find(cs, "dark-cloud")).toMatchObject({ dir: "bearish", name: "Kara bulut örtüsü" });
    expect(find(cs, "bearish-engulfing")).toBeUndefined();
  });
});

describe("üç mum formasyonları", () => {
  it("sabah yıldızı", () => {
    const cs = series([112, 111, 110], [110, 110.5, 99.5, 100], [98.5, 99.5, 98, 99], [100, 106.5, 99.5, 106]);
    expect(find(cs, "morning-star")).toMatchObject({ dir: "bullish", name: "Sabah yıldızı", index: 5 });
  });

  it("akşam yıldızı", () => {
    const cs = series([98, 99, 100], [100, 110.5, 99.5, 110], [111, 112, 110.5, 111.5], [110, 110.5, 103.5, 104]);
    expect(find(cs, "evening-star")).toMatchObject({ dir: "bearish", name: "Akşam yıldızı" });
  });

  it("üç beyaz asker", () => {
    const cs = series([98, 99, 100], [100, 105.2, 99.9, 105], [103, 108.2, 102.9, 108], [106, 111.2, 105.9, 111]);
    expect(find(cs, "three-white-soldiers")).toMatchObject({ dir: "bullish", name: "Üç beyaz asker", index: 5 });
  });

  it("üç kara karga", () => {
    const cs = series([112, 114, 116], [110, 110.1, 104.8, 105], [107, 107.1, 101.9, 102], [104, 104.1, 98.9, 99]);
    expect(find(cs, "three-black-crows")).toMatchObject({ dir: "bearish", name: "Üç kara karga" });
  });
});

describe("detectPatterns genel", () => {
  it("sıradan mumlarda formasyon bulmaz", () => {
    expect(detectPatterns(series([100, 101, 102, 103, 104, 105]), 10)).toEqual([]);
  });

  it("yalnız son 'lookback' mumdaki formasyonları döner, en yenisi başta", () => {
    const old = [mk(100, 110.2, 99.8, 110, 0)]; // marubozu, çok eski
    const mid = Array.from({ length: 12 }, (_, k) => filler(100 + k, 1 + k));
    const last = [mk(100, 105, 95, 100.5, 13)]; // doji, en yeni
    const r = detectPatterns([...old, ...mid, ...last], 10);
    expect(r.map((p) => p.id)).toEqual(["doji"]);
    const twoNew = [...old, ...mid, mk(100, 105, 95, 100.5, 13), mk(100, 110.2, 99.8, 110, 14)];
    expect(detectPatterns(twoNew, 10).map((p) => p.index)).toEqual([14, 13]);
  });

  it("sıfır menzilli mumda çökmez ve formasyon üretmez", () => {
    const flat = Array.from({ length: 6 }, (_, i) => mk(100, 100, 100, 100, i));
    expect(detectPatterns(flat, 10)).toEqual([]);
  });

  it("her formasyonda tarih (t) ve açıklama vardır", () => {
    const p = find(series([100, 101, 102], [100, 105, 95, 100.5]), "doji")!;
    expect(p.t).toBe(T0 + 3 * 86400);
    expect(p.desc.length).toBeGreaterThan(10);
  });
});
