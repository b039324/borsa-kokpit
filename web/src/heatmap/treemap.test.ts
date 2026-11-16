import { describe, expect, it } from "vitest";
import { treemap } from "./treemap";
import { heatColor } from "./color";

const items = [
  { id: "A", value: 60 }, { id: "B", value: 30 }, { id: "C", value: 20 }, { id: "D", value: 10 },
  { id: "E", value: 8 }, { id: "F", value: 5 }, { id: "G", value: 3 }, { id: "H", value: 1 },
];
const area = (r: { w: number; h: number }) => r.w * r.h;

describe("treemap", () => {
  it("boş girdi ve geçersiz boyut → boş", () => {
    expect(treemap([], 100, 100)).toEqual([]);
    expect(treemap(items, 0, 100)).toEqual([]);
    expect(treemap(items, 100, -5)).toEqual([]);
  });

  it("tek öğe tüm alanı doldurur", () => {
    expect(treemap([{ id: "A", value: 5 }], 200, 100)).toEqual([{ id: "A", x: 0, y: 0, w: 200, h: 100 }]);
  });

  it("toplam alan = w×h (boşluk yok)", () => {
    const r = treemap(items, 600, 300);
    expect(r.reduce((s, p) => s + area(p), 0)).toBeCloseTo(600 * 300, 6);
  });

  it("her kutunun alanı değeriyle orantılı", () => {
    const r = treemap(items, 600, 300);
    const total = items.reduce((s, i) => s + i.value, 0);
    for (const it of items) {
      const p = r.find((x) => x.id === it.id)!;
      expect(area(p)).toBeCloseTo((it.value / total) * 600 * 300, 6);
    }
  });

  it("tüm kutular sınırlar içinde", () => {
    for (const [w, h] of [[600, 300], [300, 600], [500, 500], [1000, 40]]) {
      for (const p of treemap(items, w, h)) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-9);
        expect(p.y).toBeGreaterThanOrEqual(-1e-9);
        expect(p.x + p.w).toBeLessThanOrEqual(w + 1e-6);
        expect(p.y + p.h).toBeLessThanOrEqual(h + 1e-6);
      }
    }
  });

  it("kutular birbiriyle çakışmaz", () => {
    const r = treemap(items, 600, 300);
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i], b = r[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > 1e-6 && oy > 1e-6).toBe(false);
      }
    }
  });

  it("büyük değer büyük kutu alır", () => {
    const r = treemap(items, 600, 300);
    expect(area(r.find((p) => p.id === "A")!)).toBeGreaterThan(area(r.find((p) => p.id === "H")!));
  });

  it("sıfır, negatif ve NaN değerleri atlar", () => {
    const r = treemap([{ id: "A", value: 5 }, { id: "Z", value: 0 }, { id: "N", value: -1 }, { id: "X", value: NaN }], 100, 100);
    expect(r.map((p) => p.id)).toEqual(["A"]);
  });

  it("100 öğede de tam doldurur ve kutular kareye yakın kalır", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `S${i}`, value: 1 + ((i * 37) % 50) }));
    const r = treemap(many, 900, 500);
    expect(r).toHaveLength(100);
    expect(r.reduce((s, p) => s + area(p), 0)).toBeCloseTo(900 * 500, 4);
    const ratios = r.map((p) => Math.max(p.w / p.h, p.h / p.w));
    const median = [...ratios].sort((a, b) => a - b)[50];
    expect(median).toBeLessThan(3);
  });

  it("girdi dizisini değiştirmez", () => {
    const copy = JSON.stringify(items);
    treemap(items, 100, 100);
    expect(JSON.stringify(items)).toBe(copy);
  });
});

describe("heatColor", () => {
  it("0 → nötr gri", () => expect(heatColor(0)).toBe("rgb(90, 96, 108)"));
  it("+CAP ve üstü → tam yeşil, aşırı değer aynı", () => {
    expect(heatColor(5)).toBe("rgb(31, 157, 85)");
    expect(heatColor(50)).toBe("rgb(31, 157, 85)");
  });
  it("−CAP ve altı → tam kırmızı", () => {
    expect(heatColor(-5)).toBe("rgb(214, 69, 69)");
    expect(heatColor(-9)).toBe("rgb(214, 69, 69)");
  });
  it("yarı değişim yarı karışım", () => {
    expect(heatColor(2.5)).toBe("rgb(61, 127, 97)"); // gri ile yeşilin ortası
  });
  it("veri yoksa ayrı bir koyu renk", () => {
    expect(heatColor(null)).toBe("rgb(60, 64, 72)");
    expect(heatColor(NaN)).toBe("rgb(60, 64, 72)");
  });
});
