import { pct } from "../format";
import { usePortfolioRows } from "../portfolio/usePortfolioRows";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

function PortfoyDagilim() {
  const { rows, status, positions } = usePortfolioRows();
  const { selected, select } = useSelection();

  if (status === "loading") return <p className="muted">Yükleniyor…</p>;
  if (status === "error") return <p className="muted">Portföy yüklenemedi; sayfayı yenile.</p>;
  if (positions.length === 0) return <p className="muted">Henüz pozisyon yok. “Portföy pozisyonları” modülünden ekle.</p>;

  const weighted = rows.filter((r) => r.weight !== null).sort((a, b) => (b.weight as number) - (a.weight as number));
  const missing = rows.filter((r) => r.weight === null).map((r) => r.symbol);

  return (
    <div className="pf-card">
      <ul className="pd-list">
        {weighted.map((r) => (
          <li key={r.symbol} aria-selected={selected === r.symbol}>
            <button type="button" className="fav-name" data-testid="pd-sym" onClick={() => select(r.symbol)}>
              {r.symbol}
            </button>
            <span className="pd-track">
              <span className="pd-bar" data-testid="pd-bar" style={{ width: `${((r.weight as number) * 100).toFixed(2)}%` }} />
            </span>
            <span className="pd-pct" data-testid="pd-pct">{pct(r.weight as number)}</span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && <p className="muted price-foot">{`Fiyatı yok: ${missing.join(", ")} (dağılıma girmez)`}</p>}
      <p className="muted price-foot">Ağırlık = pozisyon değeri ÷ toplam değer (güncel fiyatla).</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "portfoy-dagilim",
  title: "Portföy dağılımı",
  scope: "global",
  defaultSize: { w: 18, h: 18 },
  minSize: { w: 14, h: 10 },
  order: 72,
  component: PortfoyDagilim,
};

export default def;
