import { useEffect, useState } from "react";
import { getFundamentals, type Fundamentals } from "../api";
import { getToken } from "../storage";

export interface FundamentalsState {
  data: Fundamentals | null;
  loading: boolean;
  error: string | null;
}

// Temel veri yavaş değişir (Worker 1 saat önbelleğe alır) → yalnız hisse değişince bir kez çekilir, yenileme yok.
export function useFundamentals(symbol: string | null): FundamentalsState {
  const [state, setState] = useState<FundamentalsState>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!symbol) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState({ data: null, loading: true, error: null });
    getFundamentals(getToken() ?? "", symbol, ctrl.signal).then(
      (data) => !ctrl.signal.aborted && setState({ data, loading: false, error: null }),
      (e) => {
        if (ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : "Temel veri alınamadı" });
      },
    );
    return () => ctrl.abort();
  }, [symbol]);

  return state;
}
