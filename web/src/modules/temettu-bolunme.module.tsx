import { nf, pct } from "../format";
import { useQuotes } from "../hooks/useQuotes";
import { useDividends } from "../hooks/useStatements";
import { splitText, trDate, ttmTotal, yearlyTotals } from "../statements/dividends";
import type { ModuleDef, ModuleProps } from "./types";

const LAST_PAYMENTS = 10;

function TemettuBolunme({ symbol }: ModuleProps) {
  const { data, loading, error } = useDividends(symbol);
  const { quotes } = useQuotes(symbol ? [symbol] : []);

  if (loading && !data) return <p className="muted">Yükleniyor…</p>;
  if (!data) return <p className="muted">{error ?? "Veri yok."}</p>;

  const unit = !data.currency || data.currency === "TRY" ? "TL" : data.currency;
  const price = (symbol ? quotes[symbol]?.price : null) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const ttm = ttmTotal(data.dividends, today);
  const years = yearlyTotals(data.dividends, 8);

  return (
    <div className="div-card">
      <h3>Temettü</h3>
      {data.dividends.length === 0 ? (
        <p className="muted">Son 10 yılda temettü kaydı yok.</p>
      ) : (
        <>
          <dl className="price-grid">
            <dt>Son 12 ay toplam</dt>
            <dd data-testid="dv-ttm">{`${nf(ttm)} ${unit}`}</dd>
            <dt>Verim (son fiyata göre)</dt>
            <dd data-testid="dv-yield">{price ? pct(ttm / price) : "–"}</dd>
            <dt>Son temettü</dt>
            <dd>{`${trDate(data.dividends[0].date)} · ${nf(data.dividends[0].amount)} ${unit}`}</dd>
          </dl>
          <h3>Yıllara göre</h3>
          <table className="fav-table">
            <tbody>
              {years.map((y) => (
                <tr key={y.year}>
                  <th scope="row" className="fin-label">{y.year}</th>
                  <td className="fin-num" data-testid={`dv-year-${y.year}`}>{nf(y.total)}</td>
                  <td className="fin-num muted">{`${y.count} ödeme`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Son ödemeler</h3>
          <ul className="div-list">
            {data.dividends.slice(0, LAST_PAYMENTS).map((x) => (
              <li key={x.date} data-testid={`dv-pay-${x.date}`}>
                <span>{trDate(x.date)}</span>
                <span className="fin-num">{`${nf(x.amount)} ${unit}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Bölünme / bedelsiz</h3>
      {data.splits.length === 0 ? (
        <p className="muted">Bölünme / bedelsiz kaydı yok.</p>
      ) : (
        <>
          <ul className="div-list">
            {data.splits.map((s) => (
              <li key={s.date} data-testid={`dv-split-${s.date}`}>
                <span>{trDate(s.date)}</span>
                <span className="fin-num">{splitText(s)}</span>
              </li>
            ))}
          </ul>
          <p className="muted price-foot">Yahoo bedelsiz sermaye artırımlarını da bölünme olarak gösterebilir.</p>
        </>
      )}
      <p className="muted price-foot">Kaynak: Yahoo (resmi olmayan), son 10 yıl. Tutarlar hisse başına brüt. Bilgi amaçlıdır.</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "temettu-bolunme",
  title: "Temettü ve bölünme",
  scope: "stock",
  defaultSize: { w: 16, h: 26 },
  minSize: { w: 12, h: 14 },
  order: 33,
  component: TemettuBolunme,
};

export default def;
