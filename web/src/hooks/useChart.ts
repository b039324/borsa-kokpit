import { useCallback, useEffect, useRef, useState } from "react";
import { getChart, type ChartData } from "../api";
import { isMarketOpen } from "../market/session";
import { getToken } from "../storage";

export const REFRESH_MS = 15_000;

export interface ChartState {
  data: ChartData | null;
  loading: boolean;
  error: string | null; // veri varken de dolu olabilir → "güncellenemedi" uyarısı
  marketOpen: boolean;
}

interface Options {
  refreshMs?: number;
  now?: () => Date;
}

// Seçili hisse için veriyi çeker; seans açıkken her 15 sn'de yeniler, kapalıyken yenilemez.
// Hisse değişince eski istek iptal edilir ve eski hissenin verisi gösterilmez.
export function useChart(symbol: string | null, period: string, opts: Options = {}): ChartState & { reload: () => void } {
  const { refreshMs = REFRESH_MS, now = () => new Date() } = opts;
  const [state, setState] = useState<ChartState>({ data: null, loading: false, error: null, marketOpen: false });
  const nowRef = useRef(now);
  nowRef.current = now;
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!symbol) {
      setState({ data: null, loading: false, error: null, marketOpen: false });
      return;
    }
    let alive = true;
    let ctrl: AbortController | null = null;
    setState({ data: null, loading: true, error: null, marketOpen: isMarketOpen(nowRef.current()) });

    const load = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const data = await getChart(getToken() ?? "", symbol, period, ctrl.signal);
        if (alive) setState({ data, loading: false, error: null, marketOpen: isMarketOpen(nowRef.current()) });
      } catch (e) {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        const msg = e instanceof Error ? e.message : "Veri alınamadı";
        setState((s) => ({ ...s, loading: false, error: msg, marketOpen: isMarketOpen(nowRef.current()) }));
      }
    };

    void load(); // seans kapalı olsa da son veriyi göstermek için bir kez çek
    const timer = setInterval(() => {
      if (isMarketOpen(nowRef.current())) void load();
    }, refreshMs);

    return () => {
      alive = false;
      ctrl?.abort();
      clearInterval(timer);
    };
  }, [symbol, period, refreshMs, tick]);

  return { ...state, reload };
}
