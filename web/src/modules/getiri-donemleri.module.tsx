import { useChart } from "../hooks/useChart";
import { nf, pct } from "../format";
import { range52, returnSince } from "../returns/periods";
import type { ModuleDef, ModuleProps } from "./types";

// 1G chart'ın önceki kapanışından; diğerleri takvim günü önceki kapanıştan.
const PERIODS: { key: string; label: string; days: number; src: "3a" | "6a" | "1y" }[] = [
  { key: "1h", label: "1 hafta", days: 7, src: "3a" },
  { key: "1a", label: "1 ay", days: 30, src: "3a" },
  { key: "3a", label: "3 ay", days: 91, src: "3a" },
  { key: "6a", label: "6 ay", days: 182, src: "6a" },
  { key: "1y", label: "1 yıl", days: 365, src: "1y" },
];

function Cell({ id, ret }: { id: string; ret: number | null }) {
  const tone = ret === null ? "" : ret > 0 ? "up" : ret < 0 ? "down" : "";
  return (
    <dd className={tone} data-testid={`ret-${id}`}>
      {ret === null ? "–" : pct(ret, true)}
    </dd>
  );
}

function GetiriDonemleri({ symbol }: ModuleProps) {
  const short = useChart(symbol, "3a");
  const mid = useChart(symbol, "6a");
  const long = useChart(symbol, "1y");

  const base = short.data;
  if (!base) {
    return <p className="muted">{short.loading ? "Yükleniyor…" : (short.error ?? "Veri yok.")}</p>;
  }
  const price = base.price;
  const last = base.candles.at(-1);
  if (price === null || price === undefined || !last) return <p className="muted">Veri yok.</p>;

  const sources = { "3a": base.candles, "6a": mid.data?.candles ?? [], "1y": long.data?.candles ?? [] };
  const daily = base.prevClose ? price / base.prevClose - 1 : null;
  const r52 = range52(long.data?.candles ?? [], price);

  return (
    <div className="ret-card">
      <dl className="price-grid">
        <dt>1 gün</dt>
        <Cell id="1g" ret={daily} />
        {PERIODS.map((p) => (
          <FragmentRow key={p.key} label={p.label}>
            <Cell id={p.key} ret={returnSince(sources[p.src], price, last.t, p.days)} />
          </FragmentRow>
        ))}
      </dl>
      <h4 className="br-title">52 hafta aralığı</h4>
      {r52 ? (
        <div className="r52">
          <div className="r52-bar" role="img" aria-label="52 hafta aralığındaki konum">
            <i style={{ left: `${r52.pos * 100}%` }} />
          </div>
          <div className="r52-labels">
            <span data-testid="r52-low">{nf(r52.low)}</span>
            <span className="muted" data-testid="r52-pos">
              %{nf(r52.pos * 100, 1)} konumda
            </span>
            <span data-testid="r52-high">{nf(r52.high)}</span>
          </div>
        </div>
      ) : (
        <p className="muted">52 hafta verisi yok.</p>
      )}
      <p className="muted price-foot">
        Kapanışa göre, takvim günü bazlı · 52 hafta haftalık mumların en düşük/en yüksek değeri
        {short.error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

// <dl> içinde etiket + değer çiftini tek yerde tutar.
function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      {children}
    </>
  );
}

const def: ModuleDef = {
  id: "getiri-donemleri",
  title: "Dönem getirileri",
  scope: "stock",
  defaultSize: { w: 16, h: 16 },
  minSize: { w: 12, h: 12 },
  order: 46,
  component: GetiriDonemleri,
};

export default def;
