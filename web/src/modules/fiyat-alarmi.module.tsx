import { useState } from "react";
import { describeAlarm } from "../alarm/logic";
import { useAlarms } from "../alarms";
import { nf } from "../format";
import { useQuotes } from "../hooks/useQuotes";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

function FiyatAlarmi() {
  const { alarms, status, quotes, full, saveFailed, add, remove } = useAlarms();
  const { selected } = useSelection();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { quotes: local } = useQuotes(selected ? [selected] : []);
  const current = selected ? local[selected]?.price ?? null : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || current === null) return;
    const target = Number(text.trim().replace(",", "."));
    if (!Number.isFinite(target) || target <= 0) return setError("Geçerli bir fiyat gir.");
    if (target === current) return setError("Hedef güncel fiyattan farklı olmalı.");
    if (!add(selected, target > current ? "above" : "below", target)) return setError("Alarm eklenemedi.");
    setError(null);
    setText("");
  };

  if (status === "loading") return <p className="muted">Yükleniyor…</p>;
  if (status === "error") return <p className="muted">Alarmlar yüklenemedi.</p>;

  return (
    <div className="alarm-card">
      {selected ? (
        <form className="alarm-form" onSubmit={submit}>
          <div className="muted">
            {selected}: güncel {current !== null ? nf(current) : "…"}
          </div>
          <div className="alarm-input">
            <input
              aria-label="Hedef fiyat"
              inputMode="decimal"
              placeholder="Hedef fiyat"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" disabled={current === null || full}>
              Alarm kur
            </button>
          </div>
          {error && <div className="alarm-error">{error}</div>}
          {full && <div className="alarm-error">Alarm sınırına ulaşıldı (30).</div>}
        </form>
      ) : (
        <p className="muted">Alarm kurmak için soldan bir hisse seç.</p>
      )}

      {alarms.length === 0 ? (
        <p className="muted">Henüz alarm yok.</p>
      ) : (
        <ul className="alarm-list">
          {alarms.map((a) => {
            const price = quotes[a.symbol]?.price;
            return (
              <li key={a.id} data-testid={`alarm-${a.id}`} className={a.triggeredAt ? "alarm-row done" : "alarm-row"}>
                <strong>{a.symbol}</strong>
                <span>{describeAlarm(a)}</span>
                <span>{nf(a.price)}</span>
                <span className="muted">{typeof price === "number" ? nf(price) : "–"}</span>
                <span className={a.triggeredAt ? "up" : "muted"}>{a.triggeredAt ? "Tetiklendi" : "Aktif"}</span>
                <button type="button" aria-label={`${a.symbol} alarmını sil`} onClick={() => remove(a.id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted price-foot">
        Alarmlar yalnız bu sayfa açıkken kontrol edilir (seansta 15 sn'de bir, veri ~15 dk gecikmeli); sayfa kapalıyken bildirim gelmez.
        {saveFailed ? " · Son değişiklik kaydedilemedi" : ""}
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "fiyat-alarmi",
  title: "Fiyat alarmı",
  scope: "global",
  defaultSize: { w: 18, h: 16 },
  minSize: { w: 14, h: 10 },
  order: 7,
  component: FiyatAlarmi,
};

export default def;
