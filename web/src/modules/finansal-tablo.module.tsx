import { useState } from "react";
import { compact, pct } from "../format";
import { useFinancials } from "../hooks/useStatements";
import { buildColumns, type Column, type Mode } from "../statements/table";
import type { ModuleDef, ModuleProps } from "./types";

type Kind = "money" | "pct" | "growth";
interface Row {
  key: keyof Column;
  label: string;
  kind: Kind;
  tone?: boolean; // eksi/artı renklendirme
}

const ROWS: Row[] = [
  { key: "revenue", label: "Gelir", kind: "money" },
  { key: "grossProfit", label: "Brüt kâr", kind: "money" },
  { key: "operatingIncome", label: "Faaliyet kârı", kind: "money" },
  { key: "netIncome", label: "Net kâr", kind: "money", tone: true },
  { key: "netMargin", label: "Net marj", kind: "pct" },
  { key: "revenueYoy", label: "Gelir büyümesi", kind: "growth", tone: true },
  { key: "netIncomeYoy", label: "Net kâr büyümesi", kind: "growth", tone: true },
];

const MODES: { key: Mode; label: string; empty: string }[] = [
  { key: "annual", label: "Yıllık", empty: "yıllık" },
  { key: "quarterly", label: "Çeyreklik", empty: "çeyreklik" },
];

function cell(c: Column, r: Row): { text: string; cls: string } {
  const v = c[r.key] as number | null;
  if (v === null) return { text: "–", cls: "" };
  const text = r.kind === "money" ? compact(v) : r.kind === "growth" ? pct(v, true) : pct(v);
  const cls = r.tone ? `price-chg ${v > 0 ? "up" : v < 0 ? "down" : "flat"}` : "";
  return { text, cls };
}

function FinansalTablo({ symbol }: ModuleProps) {
  const { data, loading, error } = useFinancials(symbol);
  const [mode, setMode] = useState<Mode>("annual");

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  if (data.annual.length === 0 && data.quarterly.length === 0) {
    return <p className="muted">Bu hisse için finansal tablo verisi yok.</p>;
  }
  const cols = buildColumns(mode === "annual" ? data.annual : data.quarterly, mode);
  const unit = !data.currency || data.currency === "TRY" ? "TL" : data.currency;

  return (
    <div className="fin-card">
      <div className="fin-modes" role="group" aria-label="Dönem türü">
        {MODES.map((m) => (
          <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      {cols.length === 0 ? (
        <p className="muted">{`Bu hisse için ${MODES.find((m) => m.key === mode)!.empty} veri yok.`}</p>
      ) : (
        <div className="fin-scroll">
          <table className="fav-table fin-table">
            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c.date} className="fin-num">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="fin-label">{r.label}</th>
                  {cols.map((c) => {
                    const { text, cls } = cell(c, r);
                    return (
                      <td key={c.date} className={`fin-num ${cls}`} data-testid={`ft-${r.key}-${c.label}`}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted price-foot">
        {`Kaynak: Yahoo (resmi olmayan). Tutarlar ${unit}; mr = milyar, mn = milyon. Büyüme geçen yılın aynı dönemine göredir. Bankalarda gelir ve brüt kâr boş olabilir. Bilgi amaçlıdır.`}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "finansal-tablo",
  title: "Finansal tablo özeti",
  scope: "stock",
  defaultSize: { w: 28, h: 22 },
  minSize: { w: 18, h: 14 },
  order: 32,
  component: FinansalTablo,
};

export default def;
