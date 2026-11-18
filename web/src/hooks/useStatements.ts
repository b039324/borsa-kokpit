import { useEffect, useState } from "react";
import { getDividends, getFinancials, type DividendsData, type Financials } from "../api";
import { getToken } from "../storage";

export interface SymbolData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Yavaş değişen hisse verisi (Worker 1 saat önbelleğe alır): yalnız hisse değişince bir kez çekilir, yenileme yok.
function useSymbolData<T>(
  symbol: string | null,
  fetcher: (token: string, symbol: string, signal: AbortSignal) => Promise<T>,
  fallback: string,
): SymbolData<T> {
  const [state, setState] = useState<SymbolData<T>>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!symbol) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState({ data: null, loading: true, error: null });
    fetcher(getToken() ?? "", symbol, ctrl.signal).then(
      (data) => !ctrl.signal.aborted && setState({ data, loading: false, error: null }),
      (e) => {
        if (ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : fallback });
      },
    );
    return () => ctrl.abort();
    // fetcher sabit bir modül işlevi; yalnız sembol değişimi yeniden çekmeyi tetikler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return state;
}

export const useFinancials = (symbol: string | null) => useSymbolData<Financials>(symbol, getFinancials, "Finansal tablo alınamadı");
export const useDividends = (symbol: string | null) => useSymbolData<DividendsData>(symbol, getDividends, "Temettü verisi alınamadı");
