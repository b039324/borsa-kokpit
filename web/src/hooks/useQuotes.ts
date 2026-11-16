import { useEffect, useRef, useState } from "react";
import { getQuotes, type QuoteItem } from "../api";
import { REFRESH_MS } from "./useChart";
import { isMarketOpen } from "../market/session";
import { getToken } from "../storage";

export interface QuotesState {
  quotes: Record<string, QuoteItem>;
  failed: string[];
  loading: boolean;
  error: string | null;
}

interface Options {
  refreshMs?: number;
  now?: () => Date;
}

// Hisse listesinin güncel fiyatları: bir kez çeker, seans açıkken 15 sn'de bir yeniler.
export function useQuotes(symbols: string[], opts: Options = {}): QuotesState {
  const { refreshMs = REFRESH_MS, now = () => new Date() } = opts;
  const [state, setState] = useState<QuotesState>({ quotes: {}, failed: [], loading: false, error: null });
  const nowRef = useRef(now);
  nowRef.current = now;
  const key = symbols.join(","); // liste değişince yeniden başla (referans değil içerik)

  useEffect(() => {
    if (!key) {
      setState({ quotes: {}, failed: [], loading: false, error: null });
      return;
    }
    const list = key.split(",");
    let alive = true;
    let ctrl: AbortController | null = null;
    setState((s) => ({ ...s, loading: true }));

    const load = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const r = await getQuotes(getToken() ?? "", list, ctrl.signal);
        if (!alive) return;
        const map: Record<string, QuoteItem> = {};
        for (const q of r.quotes) map[q.symbol] = q;
        setState({ quotes: map, failed: r.failed, loading: false, error: null });
      } catch (e) {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Fiyatlar alınamadı" }));
      }
    };

    void load();
    const timer = setInterval(() => {
      if (isMarketOpen(nowRef.current())) void load();
    }, refreshMs);
    return () => {
      alive = false;
      ctrl?.abort();
      clearInterval(timer);
    };
  }, [key, refreshMs]);

  return state;
}
