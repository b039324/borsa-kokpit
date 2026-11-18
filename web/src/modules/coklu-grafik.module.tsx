import { useEffect, useId, useRef, useState } from "react";
import { CandleChart } from "../components/CandleChart";
import { PERIODS, PeriodBar } from "../components/PeriodBar";
import { SYMBOL_LISTS } from "../data/symbols";
import { nf, pct } from "../format";
import { useChart } from "../hooks/useChart";
import { useSize } from "../hooks/useSize";
import type { ModuleDef } from "./types";

export const STORAGE_KEY = "kokpit_coklu_grafik";
const SYMBOL_RE = /^[A-Z0-9]{2,8}$/;
const PERIOD_KEYS: string[] = PERIODS.map((p) => p.key);

interface PaneState { symbol: string; period: string }
const DEFAULTS: PaneState[] = ["THYAO", "GARAN", "AKBNK", "ASELS"].map((symbol) => ({ symbol, period: "3a" }));

// Kayıt bozuksa ya da eksikse varsayılana döner; geçerli alanlar tek tek korunur.
export function loadPanes(): PaneState[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const list = raw && Array.isArray(raw.panes) ? raw.panes : [];
    return DEFAULTS.map((d, i) => {
      const p = list[i];
      const symbol = p && typeof p.symbol === "string" && (p.symbol === "" || SYMBOL_RE.test(p.symbol)) ? p.symbol : d.symbol;
      const period = p && PERIOD_KEYS.includes(p.period) ? p.period : d.period;
      return { symbol, period };
    });
  } catch {
    return DEFAULTS;
  }
}

function Pane({ index, state, onChange, listId }: { index: number; state: PaneState; onChange: (s: PaneState) => void; listId: string }) {
  const { symbol, period } = state;
  const [draft, setDraft] = useState(symbol);
  const [err, setErr] = useState<string | null>(null);
  const { data, loading, error } = useChart(symbol || null, period);
  const box = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(box);

  const commit = (): boolean => {
    const v = draft.trim().toUpperCase();
    if (v !== "" && !SYMBOL_RE.test(v)) {
      setErr("Geçersiz hisse kodu");
      return false;
    }
    setErr(null);
    setDraft(v);
    if (v !== symbol) onChange({ symbol: v, period });
    return true;
  };

  const price = data?.price ?? null;
  const chg = price !== null && data?.prevClose ? price / data.prevClose - 1 : null;

  return (
    <section className="mc-pane" aria-label={`Pencere ${index + 1}`}>
      <div className="mc-head">
        <input
          className="mc-input"
          aria-label={`Pencere ${index + 1} hisse`}
          list={listId}
          value={draft}
          placeholder="Hisse kodu"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => { setDraft(e.target.value.toUpperCase()); setErr(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          onBlur={() => { if (!commit()) { setDraft(symbol); setErr(null); } }}
        />
        {price !== null && symbol && (
          <span className="mc-quote">
            <b data-testid="mc-price">{nf(price)}</b>
            {chg !== null && (
              <span data-testid="mc-chg" className={chg >= 0 ? "up" : "down"}> {pct(chg, true)}</span>
            )}
          </span>
        )}
        <PeriodBar value={period} onChange={(p) => onChange({ symbol, period: p })} />
      </div>
      {err && <p role="alert" className="mc-err">{err}</p>}
      <div className="chart-area mc-area" ref={box}>
        {!symbol ? (
          <p className="muted">Hisse kodu yaz.</p>
        ) : loading && !data ? (
          <p className="muted">Yükleniyor…</p>
        ) : !data ? (
          <p className="muted">{error ?? "Veri yok."}</p>
        ) : data.candles.length === 0 ? (
          <p className="muted">Bu dönem için mum verisi yok.</p>
        ) : (
          <CandleChart candles={data.candles} gmtoffset={data.gmtoffset} period={period} w={w} h={h} volume />
        )}
      </div>
    </section>
  );
}

function CokluGrafik() {
  const [panes, setPanes] = useState<PaneState[]>(loadPanes);
  const listId = useId();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ panes })); } catch { /* depolama kapalı olabilir */ }
  }, [panes]);

  return (
    <div className="mc-grid">
      <datalist id={listId}>
        {SYMBOL_LISTS.BIST100.map((s) => <option key={s} value={s} />)}
      </datalist>
      {panes.map((p, i) => (
        <Pane
          key={i}
          index={i}
          state={p}
          listId={listId}
          onChange={(s) => setPanes((cur) => cur.map((x, j) => (j === i ? s : x)))}
        />
      ))}
    </div>
  );
}

const def: ModuleDef = {
  id: "coklu-grafik",
  title: "Çoklu grafik (4 pencere)",
  scope: "global",
  defaultSize: { w: 56, h: 40 },
  minSize: { w: 30, h: 24 },
  order: 6,
  component: CokluGrafik,
};

export default def;
