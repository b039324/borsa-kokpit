import { useEffect, useState } from "react";
import { nf } from "../format";
import { useQuotes } from "../hooks/useQuotes";
import { calcPosition, parseNum } from "../sizing/position";
import type { ModuleDef, ModuleProps } from "./types";

const KEY = "kokpit_pozisyon";

function load(): { capital: string; risk: string } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      capital: typeof v.capital === "string" ? v.capital : "",
      risk: typeof v.risk === "string" ? v.risk : "1",
    };
  } catch {
    return { capital: "", risk: "1" };
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="pz-field">
      <span>{label}</span>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function PozisyonHesaplayici({ symbol }: ModuleProps) {
  const saved = useState(load)[0];
  const [capital, setCapital] = useState(saved.capital);
  const [risk, setRisk] = useState(saved.risk);
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const { quotes } = useQuotes(symbol ? [symbol] : []);
  const last = symbol ? quotes[symbol]?.price : null;

  // Sermaye ve risk yüzdesi her seferinde yeniden yazılmasın diye bu tarayıcıda hatırlanır.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ capital, risk }));
    } catch {
      /* depolama kapalıysa sorun değil */
    }
  }, [capital, risk]);

  const res = calcPosition({
    capital: parseNum(capital),
    riskPct: parseNum(risk),
    entry: parseNum(entry),
    stop: parseNum(stop),
    target: target.trim() === "" ? null : parseNum(target),
  });
  const targetTyped = target.trim() !== "";
  const targetInvalid = targetTyped && parseNum(target) === null;

  return (
    <div className="pz-card">
      <div className="pz-form">
        <Field label="Sermaye (TL)" value={capital} onChange={setCapital} />
        <Field label="Risk (%)" value={risk} onChange={setRisk} />
        <Field label="Giriş" value={entry} onChange={setEntry} />
        <Field label="Stop" value={stop} onChange={setStop} />
        <Field label="Hedef" value={target} onChange={setTarget} />
      </div>
      {last !== null && last !== undefined && (
        <button type="button" className="pz-last" onClick={() => setEntry(nf(last))}>
          Son fiyat ({nf(last)}) girişe yaz
        </button>
      )}

      {!res ? (
        <p className="muted">Sermaye, giriş ve stop fiyatını gir (stop girişten farklı olmalı).</p>
      ) : (
        <>
          {(!res.targetOk || targetInvalid) && (
            <p role="alert" className="pz-warn">
              Hedef, {res.side === "al" ? "girişin üstünde" : "girişin altında"} olmalı; hedef hesaba katılmadı.
            </p>
          )}
          {res.exceedsCapital && (
            <p role="alert" className="pz-warn">
              Pozisyon sermayeyi aşıyor. Sermayeye sığan en çok adet: {nf(res.maxSharesByCapital, 0)}.
            </p>
          )}
          <dl className="price-grid">
            <dt>Yön</dt>
            <dd data-testid="pz-yon">{res.side === "al" ? "Alım" : "Açığa satış"}</dd>
            <dt>Adet</dt>
            <dd data-testid="pz-shares">{nf(res.shares, 0)}</dd>
            <dt>Pozisyon değeri</dt>
            <dd data-testid="pz-value">
              {nf(res.value)} TL (%{nf(res.valuePct, 1)})
            </dd>
            <dt>Hisse başı risk</dt>
            <dd>{nf(res.riskPerShare)}</dd>
            <dt>Stop'ta zarar</dt>
            <dd className="down" data-testid="pz-loss">{nf(res.lossTl)}</dd>
            {res.gainTl !== null && res.rr !== null && (
              <>
                <dt>Hedefte kâr</dt>
                <dd className="up" data-testid="pz-gain">{nf(res.gainTl)}</dd>
                <dt>Risk : ödül</dt>
                <dd data-testid="pz-rr">1 : {nf(res.rr)}</dd>
              </>
            )}
          </dl>
        </>
      )}
      <p className="muted price-foot">
        Adet = (sermaye × risk%) ÷ |giriş − stop|, aşağı yuvarlanır. Komisyon ve kayma yok sayılır; yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "pozisyon-hesaplayici",
  title: "Pozisyon hesaplayıcı",
  scope: "global",
  defaultSize: { w: 16, h: 22 },
  minSize: { w: 14, h: 18 },
  order: 62,
  component: PozisyonHesaplayici,
};

export default def;
