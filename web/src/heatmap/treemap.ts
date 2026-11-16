export interface TreeItem {
  id: string;
  value: number;
}
export interface Placed {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Squarified treemap: kutu alanı değerle orantılı, kutular mümkün olduğunca kareye yakın.
// Değeri 0 veya negatif/NaN olanlar atlanır. Sonuç w×h dikdörtgenini tam doldurur.
export function treemap(items: TreeItem[], w: number, h: number): Placed[] {
  const list = items.filter((i) => Number.isFinite(i.value) && i.value > 0).sort((a, b) => b.value - a.value);
  if (list.length === 0 || w <= 0 || h <= 0) return [];
  const total = list.reduce((s, i) => s + i.value, 0);
  const scale = (w * h) / total;

  const out: Placed[] = [];
  let x = 0, y = 0, W = w, H = h;
  let row: { id: string; area: number }[] = [];

  const worst = (areas: number[], side: number) => {
    const s = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas), min = Math.min(...areas);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  const flush = () => {
    if (row.length === 0) return;
    const s = row.reduce((a, r) => a + r.area, 0);
    if (W >= H) {
      // Kısa kenar yükseklik: satır sol tarafta dikey bir sütun olur
      const cw = s / H;
      let cy = y;
      for (const r of row) {
        const ch = r.area / cw;
        out.push({ id: r.id, x, y: cy, w: cw, h: ch });
        cy += ch;
      }
      x += cw;
      W -= cw;
    } else {
      const rh = s / W;
      let cx = x;
      for (const r of row) {
        const rw = r.area / rh;
        out.push({ id: r.id, x: cx, y, w: rw, h: rh });
        cx += rw;
      }
      y += rh;
      H -= rh;
    }
    row = [];
  };

  for (const it of list) {
    const area = it.value * scale;
    const side = Math.min(W, H);
    if (row.length === 0 || worst([...row.map((r) => r.area), area], side) <= worst(row.map((r) => r.area), side)) {
      row.push({ id: it.id, area });
    } else {
      flush();
      row.push({ id: it.id, area });
    }
  }
  flush();
  return out;
}
