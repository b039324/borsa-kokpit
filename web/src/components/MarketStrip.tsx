import { nf } from "../format";
import { useMarket } from "../hooks/useMarket";

// Şeritte gösterilen kalemler (sıra Worker'dan gelir). Değiştirmek için bu listeyi düzenle.
const STRIP_KEYS = ["XU100", "XU030", "USDTRY", "EURTRY", "GOLD", "BRENT"];

// Üst çubukta tek satır endeks / kur / emtia şeridi. Veri: useMarket (seansta 15 sn'de bir yenilenir).
export function MarketStrip() {
  const { items: all } = useMarket();
  const items = all.filter((it) => STRIP_KEYS.includes(it.key));
  if (items.length === 0) return <div className="market-strip" />;
  return (
    <div className="market-strip" aria-label="Piyasa özeti">
      {items.map((it) => {
        const pct = it.price !== null && it.prevClose ? ((it.price - it.prevClose) / it.prevClose) * 100 : null;
        const tone = pct === null || pct === 0 ? "flat" : pct > 0 ? "up" : "down";
        return (
          <div key={it.key} className="strip-item" data-testid={`strip-${it.key}`}>
            <span className="muted">{it.label}</span>
            <span className="strip-price">{it.price !== null ? nf(it.price, it.decimals) : "–"}</span>
            <span className={`price-chg ${tone}`}>{pct !== null ? `${pct > 0 ? "+" : ""}${nf(pct)}%` : "–"}</span>
          </div>
        );
      })}
    </div>
  );
}
