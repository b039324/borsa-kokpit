import { useChart } from "../hooks/useChart";
import { BUY_AT, SELL_AT, computeSignal, type Verdict } from "../signal/signal";
import type { ModuleDef, ModuleProps } from "./types";

const TONE: Record<Verdict, "up" | "down" | "flat"> = { AL: "up", SAT: "down", TUT: "flat", YETERSİZ: "flat" };
const MARK = { 1: "▲", 0: "●", "-1": "▼" } as const;

function Sinyal({ symbol }: ModuleProps) {
  // Günlük mumlar (3a ≈ 63 mum): SMA 50 dahil tüm göstergeler için yeterli.
  const { data, loading, error } = useChart(symbol, "3a");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const res = computeSignal(data.candles.map((c) => c.c));

  return (
    <div className="signal-card">
      <div className={`signal-verdict ${TONE[res.verdict]}`} data-testid="verdict">
        {res.verdict}
      </div>
      {res.verdict === "YETERSİZ" ? (
        <p className="muted">Karar için yeterli geçmiş veri yok ({data.candles.length} mum).</p>
      ) : (
        <p className="muted">
          Skor {res.score > 0 ? "+" : ""}
          {res.score} / {res.voters} gösterge (AL ≥ +{BUY_AT}, SAT ≤ {SELL_AT})
        </p>
      )}
      <ul className="signal-list">
        {res.reasons.map((r) => (
          <li key={r.key} title={r.detail}>
            <span className={`signal-mark ${r.vote > 0 ? "up" : r.vote < 0 ? "down" : "flat"}`} aria-label={r.vote > 0 ? "al yönlü" : r.vote < 0 ? "sat yönlü" : "nötr"}>
              {MARK[String(r.vote) as "1" | "0" | "-1"]}
            </span>
            <span className="signal-label">{r.label}</span>
            <span className="muted signal-detail">{r.detail}</span>
          </li>
        ))}
      </ul>
      <p className="muted price-foot">Günlük mumlarla hesaplanır · bilgi amaçlıdır, yatırım tavsiyesi değildir{error ? " · Güncellenemedi" : ""}</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "sinyal",
  title: "Sinyal (al / sat / tut)",
  scope: "stock",
  defaultSize: { w: 18, h: 16 },
  minSize: { w: 12, h: 10 },
  order: 20,
  component: Sinyal,
};

export default def;
