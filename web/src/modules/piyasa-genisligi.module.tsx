import { useMemo } from "react";
import { SYMBOL_LISTS } from "../data/symbols";
import { nf, pct } from "../format";
import { useQuotes } from "../hooks/useQuotes";
import { breadth, nearLimit, rankRows, type Row } from "../market/movers";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

const SYMBOLS = SYMBOL_LISTS.BIST100;
const NEAR = 9; // günlük limit ±%10

function Chips({ rows, testId }: { rows: Row[]; testId: string }) {
  const { select } = useSelection();
  return (
    <div className="br-chips" data-testid={testId}>
      {rows.length === 0 ? (
        <span className="muted">Yok</span>
      ) : (
        rows.map((r) => (
          <button key={r.symbol} type="button" className="br-chip" onClick={() => select(r.symbol)}>
            {r.symbol}
            <small className={(r.pct ?? 0) > 0 ? "up" : "down"}>
              {" "}
              {(r.pct ?? 0) > 0 ? "+" : ""}
              {nf(r.pct ?? 0, 1)}%
            </small>
          </button>
        ))
      )}
    </div>
  );
}

function PiyasaGenisligi() {
  const { quotes, loading, error } = useQuotes(SYMBOLS);
  const rows = useMemo(() => rankRows(SYMBOLS, quotes), [quotes]);
  const b = useMemo(() => breadth(rows), [rows]);
  const near = useMemo(() => nearLimit(rows, NEAR), [rows]);

  if (b.total === 0) return <p className="muted">{loading ? "Yükleniyor…" : (error ?? "Veri yok.")}</p>;

  const w = (n: number) => `${(n / b.total) * 100}%`;
  return (
    <div className="br-card">
      <div className="br-bar" role="img" aria-label="Yükselen, yatay ve düşen oranı">
        <i className="up" style={{ width: w(b.up) }} />
        <i className="flat" style={{ width: w(b.flat) }} />
        <i className="down" style={{ width: w(b.down) }} />
      </div>
      <dl className="price-grid">
        <dt>Yükselen</dt>
        <dd className="up" data-testid="br-up">{b.up}</dd>
        <dt>Düşen</dt>
        <dd className="down" data-testid="br-down">{b.down}</dd>
        <dt>Değişmeyen</dt>
        <dd data-testid="br-flat">{b.flat}</dd>
        <dt>Yükselen oranı</dt>
        <dd data-testid="br-ratio">{pct(b.upRatio ?? 0)}</dd>
      </dl>
      <h4 className="br-title">Tavana yakın (≥ %{NEAR})</h4>
      <Chips rows={near.up} testId="br-near-up" />
      <h4 className="br-title">Tabana yakın (≤ −%{NEAR})</h4>
      <Chips rows={near.down} testId="br-near-down" />
      <p className="muted price-foot">
        BIST 100 · {b.total} hisse · günlük limit ±%10, yakınlık eşiği yaklaşık · ~15 dk gecikmeli
        {error ? " · Güncellenemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "piyasa-genisligi",
  title: "Piyasa genişliği",
  scope: "global",
  defaultSize: { w: 18, h: 18 },
  minSize: { w: 14, h: 14 },
  order: 61,
  component: PiyasaGenisligi,
};

export default def;
