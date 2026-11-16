import { macd, rsi } from "../chart/indicators";
import { useChart } from "../hooks/useChart";
import type { ModuleDef, ModuleProps } from "./types";

const nf = (n: number, d = 2) => n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
const last = <T,>(a: (T | null)[]): T | null => (a.length ? a[a.length - 1] : null);

export function rsiZone(v: number): { label: string; tone: "up" | "down" | "flat" } {
  if (v >= 70) return { label: "Aşırı alım bölgesi", tone: "down" };
  if (v <= 30) return { label: "Aşırı satım bölgesi", tone: "up" };
  return { label: "Nötr bölge", tone: "flat" };
}

function Teknik({ symbol }: ModuleProps) {
  // Günlük mumlar (3 ay ≈ 63 mum): RSI 14 ve MACD 12/26/9 için yeterli.
  const { data, loading, error } = useChart(symbol, "3a");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const closes = data.candles.map((c) => c.c);
  const r = last(rsi(closes, 14));
  const m = macd(closes);
  const mv = last(m.macd), sv = last(m.signal), hv = last(m.hist);

  if (r === null || mv === null || sv === null || hv === null) {
    return <p className="muted">Gösterge için yeterli geçmiş veri yok ({closes.length} mum, en az 35 gerekir).</p>;
  }

  const zone = rsiZone(r);
  // Gösterilen 3 basamakta sıfırsa yön yok say (float gürültüsü "pozitif/negatif" yazmasın).
  const hr = Math.round(hv * 1000) / 1000;
  const macdTone = hr > 0 ? "up" : hr < 0 ? "down" : "flat";

  return (
    <div className="tech-card">
      <section aria-label="RSI">
        <h3>RSI (14)</h3>
        <div className="tech-row">
          <span className="tech-val">{nf(r, 1)}</span>
          <span className={`price-chg ${zone.tone}`}>{zone.label}</span>
        </div>
        <div className="rsi-bar" aria-hidden="true">
          <span className="rsi-zone low" />
          <span className="rsi-zone high" />
          <span className="rsi-dot" style={{ left: `${Math.min(100, Math.max(0, r))}%` }} />
        </div>
      </section>
      <section aria-label="MACD">
        <h3>MACD (12, 26, 9)</h3>
        <dl className="price-grid">
          <dt>MACD</dt>
          <dd>{nf(mv, 3)}</dd>
          <dt>Sinyal</dt>
          <dd>{nf(sv, 3)}</dd>
          <dt>Histogram</dt>
          <dd className={`price-chg ${macdTone}`}>{nf(hv, 3)}</dd>
        </dl>
        <p className={`price-chg ${macdTone}`}>
          {hr > 0 ? "MACD sinyalin üstünde (pozitif momentum)" : hr < 0 ? "MACD sinyalin altında (negatif momentum)" : "MACD sinyal ile eşit"}
        </p>
      </section>
      <p className="muted price-foot">Günlük mumlarla hesaplanır · bilgi amaçlıdır{error ? " · Güncellenemedi" : ""}</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "teknik",
  title: "Teknik (RSI / MACD)",
  scope: "stock",
  defaultSize: { w: 16, h: 16 },
  minSize: { w: 12, h: 12 },
  order: 30,
  component: Teknik,
};

export default def;
