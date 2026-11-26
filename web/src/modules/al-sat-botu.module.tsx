import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CONFIG, newState, runBot, shouldAutoRun, summarize, turkeyDay,
  type BotConfig, type BotState,
} from "../bot/engine";
import { SYMBOL_LISTS } from "../data/symbols";
import { nf, pct } from "../format";
import { useStats } from "../hooks/useStats";
import { useSelection } from "../selection";
import type { ModuleDef } from "./types";

export const BOT_KEY = "kokpit_al_sat_botu";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function fresh(config: BotConfig = DEFAULT_CONFIG): BotState {
  return newState(config, turkeyDay(new Date()));
}

// Bozuk / eski kayıt asla çökertmez: doğrulanamazsa yeni hesap açılır.
function load(): BotState {
  try {
    const s = JSON.parse(localStorage.getItem(BOT_KEY) ?? "null");
    const c = s?.config;
    const okCfg = c && ["capital", "perTrade", "maxPositions", "feePct", "rsiMax", "stopPct", "takePct", "maxDays"].every((k) => isNum(c[k])) && typeof c.requireVolume === "boolean";
    const okPos = Array.isArray(s?.positions) && s.positions.every((p: any) => typeof p?.symbol === "string" && isNum(p.qty) && isNum(p.buyPrice) && typeof p.buyDate === "string" && isNum(p.buyFee));
    const okTr = Array.isArray(s?.trades) && s.trades.every((t: any) => typeof t?.symbol === "string" && isNum(t.pnl) && isNum(t.pnlPct) && isNum(t.qty) && isNum(t.buyPrice) && isNum(t.sellPrice));
    if (okCfg && okPos && okTr && isNum(s.cash) && (s.lastRunDate === null || typeof s.lastRunDate === "string") && typeof s.startedAt === "string") return s as BotState;
  } catch {
    /* yeni hesap */
  }
  return fresh();
}

const trDec = (n: number) => String(n).replace(".", ",");
function toCsv(s: BotState): string {
  const head = "Hisse;Adet;Alış tarihi;Alış fiyatı;Satış tarihi;Satış fiyatı;Neden;Net K/Z (TL);Net K/Z (%)";
  const rows = s.trades.map((t) => [t.symbol, t.qty, t.buyDate, trDec(t.buyPrice), t.sellDate, trDec(t.sellPrice), t.reason, trDec(+t.pnl.toFixed(2)), trDec(+t.pnlPct.toFixed(2))].join(";"));
  return "﻿" + [head, ...rows].join("\n");
}

// Sayı kutusu: yazarken boş/geçersiz değer geçici olarak tutulur, yalnız geçerli değer ayara işlenir.
function NumField({ label, value, onValid, valid = (n: number) => n > 0, step }: { label: string; value: number; onValid: (n: number) => void; valid?: (n: number) => boolean; step?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="scr-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n) && valid(n)) onValid(n);
        }}
      />
    </label>
  );
}

function AlSatBotu() {
  const [state, setState] = useState<BotState>(load);
  const { stats, loading, error } = useStats(SYMBOL_LISTS.BIST100);
  const { select } = useSelection();

  const stateRef = useRef(state);
  stateRef.current = state;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    try {
      localStorage.setItem(BOT_KEY, JSON.stringify(state));
    } catch {
      /* depolama dolu/kapalı: bellekte devam */
    }
  }, [state]);

  const scan = useCallback(() => {
    if (!statsRef.current.length) return;
    setState((s) => runBot(s, statsRef.current, turkeyDay(new Date())).state);
  }, []);

  // Günlük otomatik tarama: iş günü 18:15'ten sonra, o gün çalışmadıysa (sayfa açıkken).
  useEffect(() => {
    const tick = () => {
      if (statsRef.current.length && shouldAutoRun(stateRef.current, new Date())) scan();
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [scan, stats.length > 0]);

  const setCfg = (patch: Partial<BotConfig>) => setState((s) => ({ ...s, config: { ...s.config, ...patch } }));
  const sum = summarize(state, stats);
  const price = (sym: string) => stats.find((x) => x.symbol === sym)?.price ?? null;

  const reset = () => {
    if (window.confirm("Simülasyon hesabı sıfırlansın mı? Tüm pozisyonlar ve işlem geçmişi silinir.")) setState(fresh(state.config));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(state)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-islemler-${turkeyDay(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cfg = state.config;
  const tone = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");
  const sign = (n: number) => (n > 0 ? "+" : "");

  return (
    <div className="scr-card bot-card">
      <div className="bot-sum">
        <div><span className="muted">Toplam değer</span><strong data-testid="bot-equity">{nf(sum.equity)} TL</strong></div>
        <div><span className="muted">Nakit</span><strong data-testid="bot-cash">{nf(sum.cash)} TL</strong></div>
        <div>
          <span className="muted">Kâr / zarar</span>
          <strong data-testid="bot-pnl" className={tone(sum.pnl)}>{sign(sum.pnl)}{nf(sum.pnl)} TL ({pct(sum.pnlPct / 100, true)})</strong>
        </div>
        <div>
          <span className="muted">Kazanma oranı</span>
          <strong data-testid="bot-winrate">{sum.winRate === null ? "–" : `%${nf(sum.winRate, 0)}`} <span className="muted">({sum.wins}/{sum.closed})</span></strong>
        </div>
      </div>

      <div className="scr-bar">
        <button type="button" onClick={scan} disabled={!stats.length}>Şimdi tara</button>
        <button type="button" onClick={download} disabled={!state.trades.length}>CSV indir</button>
        <button type="button" onClick={reset}>Sıfırla</button>
        <span className="muted">
          {loading && !stats.length ? "Veri yükleniyor…" : error && !stats.length ? error : `Son tarama: ${state.lastRunDate ?? "yok"} · otomatik: iş günü 18:15'ten sonra`}
        </span>
      </div>

      <h4 className="bot-h">Açık pozisyonlar ({state.positions.length}/{cfg.maxPositions})</h4>
      {state.positions.length === 0 ? (
        <p className="muted">Açık pozisyon yok.</p>
      ) : (
        <table className="mv-table">
          <thead>
            <tr className="muted"><th align="left">Hisse</th><th className="mv-num">Adet</th><th className="mv-num">Alış</th><th className="mv-num">Güncel</th><th className="mv-num">K/Z</th></tr>
          </thead>
          <tbody>
            {state.positions.map((p) => {
              const last = price(p.symbol);
              const ch = last === null ? null : (last - p.buyPrice) / p.buyPrice;
              return (
                <tr key={p.symbol} data-testid="bot-pos">
                  <td><button type="button" className="mv-sym" onClick={() => select(p.symbol)}>{p.symbol}</button></td>
                  <td className="mv-num">{p.qty}</td>
                  <td className="mv-num">{nf(p.buyPrice)}</td>
                  <td className="mv-num">{last === null ? "–" : nf(last)}</td>
                  <td className={`mv-num ${ch === null ? "" : tone(ch)}`}>{ch === null ? "–" : pct(ch, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h4 className="bot-h">Kapanan işlemler (son 20)</h4>
      {state.trades.length === 0 ? (
        <p className="muted">Henüz kapanan işlem yok.</p>
      ) : (
        <table className="mv-table">
          <thead>
            <tr className="muted"><th align="left">Hisse</th><th>Tarih</th><th>Neden</th><th className="mv-num">Net K/Z</th></tr>
          </thead>
          <tbody>
            {state.trades.slice(-20).reverse().map((t, i) => (
              <tr key={`${t.symbol}-${t.sellDate}-${i}`} data-testid="bot-trade">
                <td>{t.symbol}</td>
                <td className="muted">{t.sellDate}</td>
                <td>{t.reason}</td>
                <td className={`mv-num ${tone(t.pnl)}`}>{sign(t.pnl)}{nf(t.pnl)} ({pct(t.pnlPct / 100, true)})</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details className="bot-settings">
        <summary>Kurallar ve ayarlar</summary>
        <p className="muted">Değişiklik yalnız sonraki taramalara uygulanır. Başlangıç sermayesini değiştirmek için "Sıfırla" kullan.</p>
        <div className="scr-filters">
          <NumField label="İşlem başı tutar (TL)" value={cfg.perTrade} onValid={(n) => setCfg({ perTrade: n })} />
          <NumField label="En fazla pozisyon" value={cfg.maxPositions} onValid={(n) => setCfg({ maxPositions: Math.floor(n) })} />
          <NumField label="Zarar durdur (%)" value={cfg.stopPct} onValid={(n) => setCfg({ stopPct: n })} step="0.5" />
          <NumField label="Kâr al (%)" value={cfg.takePct} onValid={(n) => setCfg({ takePct: n })} step="0.5" />
          <NumField label="RSI üst sınırı" value={cfg.rsiMax} onValid={(n) => setCfg({ rsiMax: n })} valid={(n) => n > 0 && n <= 100} />
          <NumField label="En uzun süre (iş günü)" value={cfg.maxDays} onValid={(n) => setCfg({ maxDays: Math.floor(n) })} valid={(n) => n >= 1} />
          <NumField label="Komisyon (%, her yön)" value={cfg.feePct} onValid={(n) => setCfg({ feePct: n })} valid={(n) => n >= 0 && n < 5} step="0.01" />
          <label className="scr-field">
            <span>Hacim filtresi</span>
            <input type="checkbox" checked={cfg.requireVolume} onChange={(e) => setCfg({ requireVolume: e.target.checked })} />
          </label>
        </div>
        <p className="muted">
          Alış: sinyal AL + RSI sınırın altında{cfg.requireVolume ? " + hacim ortalamanın üstünde" : ""}. Satış: zarar durdur → kâr al → SAT sinyali → süre.
        </p>
      </details>

      <p className="muted price-foot">
        SİMÜLASYON: gerçek para yok, emir gönderilmez. ~15 dk gecikmeli günlük özet verisiyle yaklaşık sinyal kullanılır; gerçek işlemde
        fiyat kayması ve tatil günleri farklı olabilir. Sonuçlar kâr garantisi vermez, zararla da sonuçlanabilir. Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

const def: ModuleDef = {
  id: "al-sat-botu",
  title: "Al-sat botu (simülasyon)",
  scope: "global",
  defaultSize: { w: 30, h: 38 },
  minSize: { w: 22, h: 24 },
  order: 22,
  component: AlSatBotu,
};

export default def;
