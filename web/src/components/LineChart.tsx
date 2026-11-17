export interface LineSeries {
  name: string;
  values: number[];
  className: string; // renk için CSS sınıfı
}

const W = 600;
const H = 200;
const PAD = 6;

// Basit çok çizgili SVG grafik. Tüm seriler aynı ölçeği paylaşır; `baseline` verilirse kesikli yatay çizgi çizilir.
export function LineChart({ series, baseline, label }: { series: LineSeries[]; baseline?: number; label: string }) {
  const drawn = series.filter((s) => s.values.length >= 2);
  if (drawn.length === 0) return null;

  const all = drawn.flatMap((s) => s.values);
  const min = Math.min(...all, ...(baseline !== undefined ? [baseline] : []));
  const max = Math.max(...all, ...(baseline !== undefined ? [baseline] : []));
  const span = max - min || 1;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const pts = (vs: number[]) =>
    vs.map((v, i) => `${((i / (vs.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {baseline !== undefined && (
        <line className="lc-base" x1={0} x2={W} y1={y(baseline)} y2={y(baseline)} vectorEffect="non-scaling-stroke" />
      )}
      {drawn.map((s) => (
        <polyline
          key={s.name}
          className={`lc-line ${s.className}`}
          data-testid={`lc-${s.className}`}
          points={pts(s.values)}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
