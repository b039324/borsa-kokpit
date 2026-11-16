import type { Fundamentals } from "../api";
import { compact, nf, pct } from "../format";
import { useFundamentals } from "../hooks/useFundamentals";
import type { ModuleDef, ModuleProps } from "./types";

type Kind = "x" | "pct" | "growth" | "money" | "cap" | "pctRaw";
interface Row {
  key: keyof Fundamentals;
  label: string;
  kind: Kind;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Değerleme",
    rows: [
      { key: "marketCap", label: "Piyasa değeri", kind: "cap" },
      { key: "trailingPE", label: "F/K", kind: "x" },
      { key: "forwardPE", label: "İleri F/K", kind: "x" },
      { key: "priceToBook", label: "PD/DD", kind: "x" },
      { key: "enterpriseToEbitda", label: "FD/FAVÖK", kind: "x" },
      { key: "priceToSales", label: "Fiyat/Satış", kind: "x" },
    ],
  },
  {
    title: "Kârlılık",
    rows: [
      { key: "returnOnEquity", label: "Özkaynak kârlılığı (ROE)", kind: "pct" },
      { key: "returnOnAssets", label: "Aktif kârlılığı (ROA)", kind: "pct" },
      { key: "grossMargins", label: "Brüt marj", kind: "pct" },
      { key: "operatingMargins", label: "Faaliyet marjı", kind: "pct" },
      { key: "profitMargins", label: "Net marj", kind: "pct" },
    ],
  },
  {
    title: "Büyüme (yıllık)",
    rows: [
      { key: "revenueGrowth", label: "Gelir büyümesi", kind: "growth" },
      { key: "earningsGrowth", label: "Kâr büyümesi", kind: "growth" },
    ],
  },
  {
    title: "Borç ve likidite",
    rows: [
      { key: "debtToEquity", label: "Borç / özkaynak", kind: "pctRaw" },
      { key: "currentRatio", label: "Cari oran", kind: "x" },
    ],
  },
  {
    title: "Hisse başına ve fiyat",
    rows: [
      { key: "trailingEps", label: "Hisse başı kâr (HBK)", kind: "money" },
      { key: "bookValue", label: "Defter değeri / hisse", kind: "money" },
      { key: "dividendYield", label: "Temettü verimi", kind: "pct" },
      { key: "beta", label: "Beta", kind: "x" },
      { key: "fiftyTwoWeekHigh", label: "52 hafta en yüksek", kind: "money" },
      { key: "fiftyTwoWeekLow", label: "52 hafta en düşük", kind: "money" },
      { key: "fiftyDayAverage", label: "50 günlük ort.", kind: "money" },
      { key: "twoHundredDayAverage", label: "200 günlük ort.", kind: "money" },
    ],
  },
];

function fmt(kind: Kind, v: number): { text: string; tone: string } {
  switch (kind) {
    case "pct":
      return { text: pct(v), tone: "" };
    case "growth":
      return { text: pct(v, true), tone: v > 0 ? "up" : v < 0 ? "down" : "" };
    case "pctRaw": // Yahoo yüzde olarak verir
      return { text: `${nf(v)}%`, tone: "" };
    case "cap":
      return { text: compact(v), tone: "" };
    default:
      return { text: nf(v), tone: "" };
  }
}

function Temel({ symbol }: ModuleProps) {
  const { data, loading, error } = useFundamentals(symbol);

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const hasAny = GROUPS.some((g) => g.rows.some((r) => typeof data[r.key] === "number"));
  if (!hasAny) return <p className="muted">Bu hisse için temel veri bulunamadı.</p>;

  return (
    <div className="fund-card">
      {data.name && <div className="fund-name">{data.name}</div>}
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="fund-title">{g.title}</h3>
          <dl className="price-grid">
            {g.rows.map((r) => {
              const v = data[r.key];
              const f = typeof v === "number" ? fmt(r.kind, v) : null;
              return (
                <div key={r.key} style={{ display: "contents" }}>
                  <dt>{r.label}</dt>
                  <dd data-testid={`f-${r.key}`} className={f?.tone ?? ""}>
                    {f ? f.text : "–"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
      <p className="muted price-foot">
        Kaynak: Yahoo Finance; BIST hisselerinde bazı alanlar eksik veya gecikmeli olabilir. Bilgi amaçlıdır, yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "temel",
  title: "Temel analiz",
  scope: "stock",
  defaultSize: { w: 18, h: 28 },
  minSize: { w: 12, h: 12 },
  order: 35,
  component: Temel,
};

export default def;
