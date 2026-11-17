import { fmtDay } from "../format";
import { useChart } from "../hooks/useChart";
import { detectPatterns, type PatternDir } from "../patterns/patterns";
import type { ModuleDef, ModuleProps } from "./types";

const LOOKBACK = 10; // son 10 günlük mum
const DIR_LABEL: Record<PatternDir, string> = { bullish: "Yükseliş", bearish: "Düşüş", neutral: "Kararsızlık" };
const DIR_CLASS: Record<PatternDir, string> = { bullish: "up", bearish: "down", neutral: "flat" };

function MumFormasyonu({ symbol }: ModuleProps) {
  const { data, loading, error } = useChart(symbol, "3a");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const found = detectPatterns(data.candles, LOOKBACK);
  return (
    <div className="pattern-card">
      {found.length === 0 ? (
        <p className="muted">Son {LOOKBACK} günde belirgin formasyon yok.</p>
      ) : (
        <ul className="pattern-list">
          {found.map((p) => (
            <li key={`${p.id}-${p.index}`} data-testid={`pattern-${p.id}`} className="pattern-row">
              <div className="pattern-head">
                <span className="muted">{fmtDay(p.t, data.gmtoffset).slice(0, 5)}</span>
                <strong>{p.name}</strong>
                <span className={`pattern-dir ${DIR_CLASS[p.dir]}`}>{DIR_LABEL[p.dir]}</span>
              </div>
              <div className="muted pattern-desc">{p.desc}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted price-foot">
        Günlük mumlardan, basit gövde/fitil eşikleriyle bulunur; tek başına sinyal sayılmaz, teyit gerekir. Bilgi amaçlıdır, yatırım
        tavsiyesi değildir.
        {error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "mum-formasyonu",
  title: "Mum formasyonu",
  scope: "stock",
  defaultSize: { w: 16, h: 16 },
  minSize: { w: 12, h: 10 },
  order: 50,
  component: MumFormasyonu,
};

export default def;
