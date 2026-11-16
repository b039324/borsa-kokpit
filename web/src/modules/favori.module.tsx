import { nf } from "../format";
import { useFavorites } from "../favorites";
import { useQuotes } from "../hooks/useQuotes";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

function Favori() {
  const { symbols, status, toggle, saveFailed } = useFavorites();
  const { quotes, failed, loading, error } = useQuotes(symbols);
  const { selected, select } = useSelection();

  if (status === "loading") return <p className="muted">Yükleniyor…</p>;
  if (status === "error") return <p className="muted">Favoriler yüklenemedi; sayfayı yenile.</p>;
  if (symbols.length === 0) return <p className="muted">Henüz favori yok. Soldaki listede hissenin yanındaki ☆ işaretine bas.</p>;

  return (
    <div className="fav-card">
      <table className="fav-table">
        <thead>
          <tr>
            <th>Hisse</th>
            <th>Fiyat</th>
            <th>Değişim</th>
            <th aria-label="Çıkar" />
          </tr>
        </thead>
        <tbody>
          {symbols.map((s) => {
            const q = quotes[s];
            const price = q?.price ?? null;
            const prev = q?.prevClose ?? null;
            const pct = price !== null && prev ? ((price - prev) / prev) * 100 : null;
            const tone = pct === null || pct === 0 ? "flat" : pct > 0 ? "up" : "down";
            return (
              <tr key={s} aria-selected={selected === s}>
                <td>
                  <button type="button" className="fav-name" onClick={() => select(s)}>
                    {s}
                  </button>
                </td>
                <td>{price !== null ? nf(price) : failed.includes(s) ? "yok" : loading ? "…" : "–"}</td>
                <td className={`price-chg ${tone}`}>
                  {pct !== null ? `${pct > 0 ? "+" : ""}${nf(pct)}%` : "–"}
                </td>
                <td>
                  <button type="button" className="fav-remove" aria-label={`${s} favoriden çıkar`} onClick={() => toggle(s)}>
                    ★
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted price-foot">
        ~15 dk gecikmeli · seans içinde 15 sn'de bir yenilenir
        {error ? " · Güncellenemedi" : ""}
        {saveFailed ? " · Son değişiklik kaydedilemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "favori",
  title: "Favori izleme",
  scope: "global",
  defaultSize: { w: 16, h: 18 },
  minSize: { w: 12, h: 8 },
  order: 1,
  component: Favori,
};

export default def;
