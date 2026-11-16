import { useEffect, useRef, useState } from "react";
import { getMarket, type MarketItem } from "../api";
import { isMarketOpen } from "../market/session";
import { getToken } from "../storage";
import { REFRESH_MS } from "./useChart";

export interface MarketState {
  items: MarketItem[];
  loading: boolean;
  error: string | null;
}

interface Options {
  refreshMs?: number;
  now?: () => Date;
}

// Piyasa özeti: bir kez çeker, BIST seansı açıkken 15 sn'de bir yeniler (kapalıyken durur).
export function useMarket(opts: Options = {}): MarketState {
  const { refreshMs = REFRESH_MS, now = () => new Date() } = opts;
  const [state, setState] = useState<MarketState>({ items: [], loading: true, error: null });
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;
    const load = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const items = await getMarket(getToken() ?? "", ctrl.signal);
        if (alive) setState({ items, loading: false, error: null });
      } catch (e) {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Piyasa verisi alınamadı" }));
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
  }, [refreshMs]);

  return state;
}
