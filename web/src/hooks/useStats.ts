import { useEffect, useRef, useState } from "react";
import { getStats, type StatsItem } from "../api";
import { isMarketOpen } from "../market/session";
import { getToken } from "../storage";

export const STATS_REFRESH_MS = 300_000; // geçmiş yavaş değişir; Worker da 5 dk önbellekler

export interface StatsState {
  stats: StatsItem[];
  failed: string[];
  loading: boolean;
  error: string | null;
}

interface Options {
  refreshMs?: number;
  now?: () => Date;
}

// Hisse listesinin hacim ve oynaklık özeti: bir kez çeker, seans açıkken 5 dk'da bir yeniler.
export function useStats(symbols: string[], opts: Options = {}): StatsState {
  const { refreshMs = STATS_REFRESH_MS, now = () => new Date() } = opts;
  const [state, setState] = useState<StatsState>({ stats: [], failed: [], loading: false, error: null });
  const nowRef = useRef(now);
  nowRef.current = now;
  const key = symbols.join(",");

  useEffect(() => {
    if (!key) {
      setState({ stats: [], failed: [], loading: false, error: null });
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
        const r = await getStats(getToken() ?? "", list, ctrl.signal);
        if (!alive) return;
        setState({ stats: r.stats, failed: r.failed, loading: false, error: null });
      } catch (e) {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "İstatistikler alınamadı" }));
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
