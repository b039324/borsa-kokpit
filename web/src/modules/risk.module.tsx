import { useChart } from "../hooks/useChart";
import { fmtDay, pct } from "../format";
import { riskStats } from "../risk/stats";
import type { ModuleDef, ModuleProps } from "./types";

const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);

function Risk({ symbol }: ModuleProps) {
  const { data, loading, error } = useChart(symbol, "3a");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;
  const s = riskStats(data.candles);
  if (!s) return <p className="muted">Risk hesabı için yeterli veri yok.</p>;

  const tone = s.level === "düşük" ? "up" : s.level === "yüksek" ? "down" : "";
  return (
    <div className="risk-card">
      <div className="risk-head">
        <span className="muted">Oynaklık seviyesi</span>
        <span className={`risk-level ${tone}`} data-testid="r-level">
          {cap(s.level)}
        </span>
      </div>
      <dl className="price-grid">
        <dt>Yıllık oynaklık</dt>
        <dd data-testid="r-vol">{pct(s.vol)}</dd>
        <dt>Maks. düşüş (3 ay)</dt>
        <dd data-testid="r-maxdd" className="down">{pct(s.maxDrawdown)}</dd>
        <dt>Zirveden bugünkü uzaklık</dt>
        <dd data-testid="r-curdd">{pct(s.currentDrawdown)}</dd>
        <dt>En kötü gün ({fmtDay(s.worst.t, data.gmtoffset)})</dt>
        <dd data-testid="r-worst" className="down">{pct(s.worst.ret)}</dd>
        <dt>En iyi gün ({fmtDay(s.best.t, data.gmtoffset)})</dt>
        <dd data-testid="r-best" className="up">{pct(s.best.ret, true)}</dd>
        <dt>%95 günlük VaR</dt>
        <dd data-testid="r-var">{pct(s.var95)}</dd>
        <dt>Yükselen gün oranı</dt>
        <dd data-testid="r-up">{pct(s.upRatio)}</dd>
      </dl>
      <p className="muted price-foot">
        Son {s.n} günlük kapanışlardan hesaplanır. Geçmiş veriye dayanır, geleceği garanti etmez; yatırım tavsiyesi değildir.
        Seviye sınırları: &lt;%25 düşük, &lt;%45 orta, üstü yüksek (yaklaşık).
        {error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "risk",
  title: "Risk",
  scope: "stock",
  defaultSize: { w: 16, h: 16 },
  minSize: { w: 12, h: 12 },
  order: 45,
  component: Risk,
};

export default def;
