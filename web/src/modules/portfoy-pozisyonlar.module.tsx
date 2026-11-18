import { useState, type FormEvent } from "react";
import { nf, pct } from "../format";
import { MAX_POSITIONS, usePortfolio } from "../portfolio/PortfolioProvider";
import { usePortfolioRows } from "../portfolio/usePortfolioRows";
import { useSelection } from "../selection";
import { parseNum } from "../sizing/position";
import type { ModuleDef, ModuleProps } from "./types";

const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;
const signed = (v: number) => `${v > 0 ? "+" : ""}${nf(v)}`;
const tone = (v: number | null) => (v === null || v === 0 ? "flat" : v > 0 ? "up" : "down");
const qtyText = (q: number) => nf(q, Number.isInteger(q) ? 0 : 2);

function Pozisyonlar({ symbol }: ModuleProps) {
  const { add, set, remove, full } = usePortfolio();
  const { rows, status, saveFailed, error } = usePortfolioRows();
  const { selected, select } = useSelection();

  const [code, setCode] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [eQty, setEQty] = useState("");
  const [eCost, setECost] = useState("");

  if (status === "loading") return <p className="muted">Yükleniyor…</p>;
  if (status === "error") return <p className="muted">Portföy yüklenemedi; sayfayı yenile.</p>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = code.trim().toUpperCase();
    const q = parseNum(qty);
    const c = parseNum(cost);
    if (!SYMBOL_RE.test(s) || q === null || c === null) {
      setFormError("Hisse kodu, adet ve maliyet gerekli (adet ve maliyet sıfırdan büyük olmalı).");
      return;
    }
    if (full && !rows.some((r) => r.symbol === s)) {
      setFormError(`En fazla ${MAX_POSITIONS} pozisyon eklenebilir.`);
      return;
    }
    add(s, q, c);
    setCode("");
    setQty("");
    setCost("");
    setFormError(null);
  };

  const startEdit = (s: string, q: number, c: number) => {
    setEditing(s);
    setEQty(String(q).replace(".", ","));
    setECost(String(c).replace(".", ","));
    setFormError(null);
  };
  const saveEdit = () => {
    if (editing === null) return;
    const q = parseNum(eQty);
    const c = parseNum(eCost);
    if (q === null || c === null) {
      setFormError("Adet ve maliyet sıfırdan büyük bir sayı olmalı.");
      return;
    }
    set(editing, q, c);
    setEditing(null);
    setFormError(null);
  };
  const del = (s: string) => {
    if (window.confirm(`${s} pozisyonu silinsin mi?`)) remove(s);
  };

  return (
    <div className="pf-card">
      <form className="pf-form" onSubmit={submit}>
        <label>
          <span>Hisse</span>
          <input value={code} maxLength={8} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <label>
          <span>Adet</span>
          <input value={qty} inputMode="decimal" onChange={(e) => setQty(e.target.value)} />
        </label>
        <label>
          <span>Maliyet</span>
          <input value={cost} inputMode="decimal" onChange={(e) => setCost(e.target.value)} />
        </label>
        <button type="submit">Ekle</button>
        {symbol && (
          <button type="button" onClick={() => setCode(symbol)}>
            {`Seçili hisse (${symbol})`}
          </button>
        )}
      </form>
      {formError && (
        <p role="alert" className="pf-error">
          {formError}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="muted">Henüz pozisyon yok. Yukarıdan hisse kodu, adet ve ortalama maliyeti girip Ekle'ye bas.</p>
      ) : (
        <div className="pf-scroll">
          <table className="fav-table">
            <thead>
              <tr>
                <th>Hisse</th>
                <th>Adet</th>
                <th>Maliyet</th>
                <th>Fiyat</th>
                <th>Değer</th>
                <th>K/Z</th>
                <th>K/Z %</th>
                <th aria-label="İşlemler" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isEdit = editing === r.symbol;
                return (
                  <tr key={r.symbol} aria-selected={selected === r.symbol}>
                    <td>
                      <button type="button" className="fav-name" onClick={() => select(r.symbol)}>
                        {r.symbol}
                      </button>
                    </td>
                    {isEdit ? (
                      <>
                        <td>
                          <input className="pf-edit" aria-label={`${r.symbol} adet`} value={eQty} inputMode="decimal" onChange={(e) => setEQty(e.target.value)} />
                        </td>
                        <td>
                          <input className="pf-edit" aria-label={`${r.symbol} maliyet`} value={eCost} inputMode="decimal" onChange={(e) => setECost(e.target.value)} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{qtyText(r.qty)}</td>
                        <td>{nf(r.cost)}</td>
                      </>
                    )}
                    <td>{r.price !== null ? nf(r.price) : "–"}</td>
                    <td data-testid="pp-value">{r.value !== null ? nf(r.value) : "–"}</td>
                    <td data-testid="pp-pl" className={`price-chg ${tone(r.pl)}`}>
                      {r.pl !== null ? signed(r.pl) : "–"}
                    </td>
                    <td data-testid="pp-plpct" className={`price-chg ${tone(r.plPct)}`}>
                      {r.plPct !== null ? pct(r.plPct, true) : "–"}
                    </td>
                    <td className="pf-actions">
                      {isEdit ? (
                        <>
                          <button type="button" onClick={saveEdit}>Kaydet</button>
                          <button type="button" onClick={() => setEditing(null)}>İptal</button>
                        </>
                      ) : (
                        <>
                          <button type="button" aria-label={`${r.symbol} düzenle`} onClick={() => startEdit(r.symbol, r.qty, r.cost)}>✎</button>
                          <button type="button" aria-label={`${r.symbol} sil`} onClick={() => del(r.symbol)}>×</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted price-foot">
        Maliyet = hisse başına ortalama (TL). Aynı hisseyi tekrar eklersen adetler toplanır, maliyet ortalanır. Veri sunucuda saklanır.
        ~15 dk gecikmeli
        {error ? " · Fiyatlar güncellenemedi" : ""}
        {saveFailed ? " · Son değişiklik kaydedilemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "portfoy-pozisyonlar",
  title: "Portföy pozisyonları",
  scope: "global",
  defaultSize: { w: 36, h: 28 },
  minSize: { w: 24, h: 16 },
  order: 70,
  component: Pozisyonlar,
};

export default def;
