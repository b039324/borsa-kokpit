import { nf, pct } from "../format";
import { usePortfolioRows } from "../portfolio/usePortfolioRows";
import type { ModuleDef } from "./types";

const tone = (v: number | null) => (v === null || v === 0 ? "flat" : v > 0 ? "up" : "down");
const signed = (v: number) => `${v > 0 ? "+" : ""}${nf(v)}`;

function PortfoyOzet() {
  const { totals, status, saveFailed, error, positions } = usePortfolioRows();

  if (status === "loading") return <p className="muted">Yükleniyor…</p>;
  if (status === "error") return <p className="muted">Portföy yüklenemedi; sayfayı yenile.</p>;
  if (positions.length === 0) return <p className="muted">Henüz pozisyon yok. “Portföy pozisyonları” modülünden ekle.</p>;

  const t = totals;
  return (
    <div className="pf-card">
      <p className="pf-big" data-testid="po-value">{t.priced ? `${nf(t.value)} TL` : "–"}</p>
      <p className="muted">Toplam değer</p>
      <dl className="price-grid">
        <dt>Maliyet</dt>
        <dd data-testid="po-cost">{t.priced ? `${nf(t.cost)} TL` : "–"}</dd>
        <dt>Kâr / zarar</dt>
        <dd data-testid="po-pl" className={`price-chg ${tone(t.priced ? t.pl : null)}`}>
          {t.priced ? `${signed(t.pl)} TL${t.plPct !== null ? ` (${pct(t.plPct, true)})` : ""}` : "–"}
        </dd>
        <dt>Bugün</dt>
        <dd data-testid="po-day" className={`price-chg ${tone(t.priced ? t.dayPl : null)}`}>
          {t.priced ? `${signed(t.dayPl)} TL${t.dayPct !== null ? ` (${pct(t.dayPct, true)})` : ""}` : "–"}
        </dd>
      </dl>
      {t.priced < t.total && (
        <p className="muted price-foot">{`${t.priced} / ${t.total} pozisyonun fiyatı var; toplamlar yalnız onları içerir.`}</p>
      )}
      <p className="muted price-foot">
        ~15 dk gecikmeli · komisyon ve vergi hesaba katılmaz · bilgi amaçlıdır
        {error ? " · Fiyatlar güncellenemedi" : ""}
        {saveFailed ? " · Son değişiklik kaydedilemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "portfoy-ozet",
  title: "Portföy özeti",
  scope: "global",
  defaultSize: { w: 16, h: 14 },
  minSize: { w: 12, h: 10 },
  order: 71,
  component: PortfoyOzet,
};

export default def;
