// Günlük değişim % → renk. 0 gri; pozitif yeşil, negatif kırmızı; ±CAP ve ötesinde en koyu.
export const CAP = 5;

const GRAY = [90, 96, 108];
const GREEN = [31, 157, 85];
const RED = [214, 69, 69];

export function heatColor(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "rgb(60, 64, 72)"; // veri yok
  const t = Math.min(1, Math.abs(pct) / CAP);
  const to = pct >= 0 ? GREEN : RED;
  const c = GRAY.map((g, i) => Math.round(g + (to[i] - g) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
