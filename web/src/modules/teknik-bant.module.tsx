import { atr, bollinger, stochastic } from "../chart/indicators";
import { nf } from "../format";
import { useChart } from "../hooks/useChart";
import type { ModuleDef, ModuleProps } from "./types";

type Tone = "up" | "down" | "flat";
const MIN_CANDLES = 20;
const last = <T,>(a: (T | null)[]): T | null => (a.length ? a[a.length - 1] : null);

// %B: 0 = alt bant, 1 = üst bant. Üstte "down" (pahalı bölge), altta "up" (ucuz bölge) — RSI modülüyle aynı renk mantığı.
export function bandZone(pctB: number): { label: string; tone: Tone } {
  if (pctB > 1) return { label: "Üst bandın üstünde", tone: "down" };
  if (pctB >= 0.8) return { label: "Üst banda yakın", tone: "down" };
  if (pctB < 0) return { label: "Alt bandın altında", tone: "up" };
  if (pctB <= 0.2) return { label: "Alt banda yakın", tone: "up" };
  return { label: "Bantların içinde", tone: "flat" };
}

export function stochZone(k: number): { label: string; tone: Tone } {
  if (k >= 80) return { label: "Aşırı alım bölgesi", tone: "down" };
  if (k <= 20) return { label: "Aşırı satım bölgesi", tone: "up" };
  return { label: "Nötr bölge", tone: "flat" };
}

function TeknikBant({ symbol }: ModuleProps) {
  // Günlük mumlar (3 ay ≈ 63 mum): Bollinger 20, ATR 14 ve Stochastic 14/3/3 için yeterli.
  const { data, loading, error } = useChart(symbol, "3a");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const candles = data.candles;
  const closes = candles.map((c) => c.c);
  const price = data.price ?? last(closes);
  const b = bollinger(closes, 20, 2);
  const up = last(b.upper), mid = last(b.mid), lo = last(b.lower);
  const a = last(atr(candles, 14));
  const st = stochastic(candles, 14, 3, 3);
  const k = last(st.k), d = last(st.d);

  if (candles.length < MIN_CANDLES || price === null || up === null || mid === null || lo === null || a === null || k === null || d === null) {
    return <p className="muted">Gösterge için yeterli geçmiş veri yok ({candles.length} mum, en az {MIN_CANDLES} gerekir).</p>;
  }

  const width = up - lo;
  const pctB = width > 0 ? (price - lo) / width : null;
  const zone = pctB === null ? null : bandZone(pctB);
  const sz = stochZone(k);
  const kd = Math.round((k - d) * 10) / 10; // gösterilen basamakta eşitse yön yok say
  const kdTone: Tone = kd > 0 ? "up" : kd < 0 ? "down" : "flat";

  return (
    <div className="tech-card">
      <section aria-label="Bollinger">
        <h3>Bollinger (20, 2)</h3>
        {pctB === null ? (
          <p className="muted">Bantlar daraldı (oynaklık yok)</p>
        ) : (
          <div className="tech-row">
            <span className="tech-val" data-testid="bb-pctb" title="%B: 0 alt bant, 1 üst bant">{nf(pctB, 2)}</span>
            <span className={`price-chg ${zone!.tone}`}>{zone!.label}</span>
          </div>
        )}
        <dl className="price-grid">
          <dt>Üst</dt>
          <dd data-testid="bb-upper">{nf(up)}</dd>
          <dt>Orta (SMA20)</dt>
          <dd data-testid="bb-mid">{nf(mid)}</dd>
          <dt>Alt</dt>
          <dd data-testid="bb-lower">{nf(lo)}</dd>
          <dt>Bant genişliği</dt>
          <dd>{mid > 0 ? `${nf((width / mid) * 100)}%` : "–"}</dd>
        </dl>
      </section>
      <section aria-label="ATR">
        <h3>ATR (14)</h3>
        <dl className="price-grid">
          <dt>Ortalama aralık</dt>
          <dd data-testid="atr-val">{nf(a)}</dd>
          <dt>Fiyata oranı</dt>
          <dd data-testid="atr-pct">{price > 0 ? `${nf((a / price) * 100)}%` : "–"}</dd>
        </dl>
      </section>
      <section aria-label="Stochastic">
        <h3>Stochastic (14, 3, 3)</h3>
        <div className="tech-row">
          <span className="tech-val" data-testid="st-k">{nf(k, 1)}</span>
          <span className={`price-chg ${sz.tone}`}>{sz.label}</span>
        </div>
        <dl className="price-grid">
          <dt>%K</dt>
          <dd>{nf(k, 1)}</dd>
          <dt>%D</dt>
          <dd data-testid="st-d">{nf(d, 1)}</dd>
        </dl>
        <p className={`price-chg ${kdTone}`}>
          {kd > 0 ? "%K, %D'nin üstünde" : kd < 0 ? "%K, %D'nin altında" : "%K, %D'ye eşit"}
        </p>
      </section>
      <p className="muted price-foot">Günlük mumlarla hesaplanır · bilgi amaçlıdır{error ? " · Güncellenemedi" : ""}</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "teknik-bant",
  title: "Bollinger / ATR / Stochastic",
  scope: "stock",
  defaultSize: { w: 16, h: 24 },
  minSize: { w: 12, h: 16 },
  order: 31,
  component: TeknikBant,
};

export default def;
