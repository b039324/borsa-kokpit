import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getFavorites, saveFavorites } from "./api";
import { getToken } from "./storage";

export const MAX_FAVORITES = 50; // Worker ile aynı

export type FavStatus = "loading" | "ready" | "error";

interface FavoritesValue {
  symbols: string[];
  status: FavStatus;
  has: (symbol: string) => boolean;
  toggle: (symbol: string) => void;
  // Son kayıt başarısızsa true (liste ekranda güncel, sunucuda eski)
  saveFailed: boolean;
  full: boolean;
}

// Provider yoksa (ör. yalnız Sidebar'ı deneyen testler) boş ve etkisiz bir liste gibi davranır.
const EMPTY: FavoritesValue = {
  symbols: [], status: "ready", has: () => false, toggle: () => {}, saveFailed: false, full: false,
};
const FavoritesContext = createContext<FavoritesValue>(EMPTY);

// Güvenlik kuralı (düzendeki gibi): yükleme başarısızsa hiçbir şey kaydedilmez,
// böylece sunucudaki liste yanlışlıkla boş listeyle ezilmez.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [status, setStatus] = useState<FavStatus>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef<string[]>([]);
  const statusRef = useRef<FavStatus>("loading");
  const saving = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    getFavorites(getToken() ?? "").then(
      (list) => {
        if (!alive) return;
        ref.current = list;
        statusRef.current = "ready";
        setSymbols(list);
        setStatus("ready");
      },
      () => {
        if (!alive) return;
        statusRef.current = "error";
        setStatus("error");
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  // Kayıtlar sırayla gider; araya yeni değişiklik girerse bitince son hali bir kez daha gönderilir.
  const flush = useCallback(async () => {
    if (saving.current) {
      dirty.current = true;
      return;
    }
    saving.current = true;
    try {
      do {
        dirty.current = false;
        try {
          await saveFavorites(getToken() ?? "", ref.current);
          setSaveFailed(false);
        } catch {
          setSaveFailed(true);
          dirty.current = false;
        }
      } while (dirty.current);
    } finally {
      saving.current = false;
    }
  }, []);

  const toggle = useCallback(
    (symbol: string) => {
      if (statusRef.current !== "ready") return;
      const cur = ref.current;
      const next = cur.includes(symbol)
        ? cur.filter((s) => s !== symbol)
        : cur.length >= MAX_FAVORITES
          ? cur
          : [...cur, symbol];
      if (next === cur) return;
      ref.current = next;
      setSymbols(next);
      void flush();
    },
    [flush],
  );

  const value = useMemo<FavoritesValue>(
    () => ({
      symbols, status, saveFailed,
      has: (s) => symbols.includes(s),
      toggle,
      full: symbols.length >= MAX_FAVORITES,
    }),
    [symbols, status, saveFailed, toggle],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  return useContext(FavoritesContext);
}
