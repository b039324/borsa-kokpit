import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getPortfolio, savePortfolio } from "../api";
import { getToken } from "../storage";
import { mergeLot, type Position } from "./calc";

export const MAX_POSITIONS = 100; // Worker ile aynı

export type PortfolioStatus = "loading" | "ready" | "error";

interface PortfolioValue {
  positions: Position[];
  status: PortfolioStatus;
  // Son kayıt başarısızsa true (ekranda güncel, sunucuda eski)
  saveFailed: boolean;
  full: boolean;
  // Alım ekler: aynı hissede adet toplanır, maliyet ağırlıklı ortalama olur.
  add: (symbol: string, qty: number, cost: number) => void;
  // Pozisyonu verilen değerlerle değiştirir (düzeltme).
  set: (symbol: string, qty: number, cost: number) => void;
  remove: (symbol: string) => void;
}

const EMPTY: PortfolioValue = {
  positions: [], status: "ready", saveFailed: false, full: false, add: () => {}, set: () => {}, remove: () => {},
};
const PortfolioContext = createContext<PortfolioValue>(EMPTY);

// Veri sunucuda durur (KV): sekme ya da modül kapatılsa da silinmez, her cihazda aynıdır.
// Güvenlik kuralı: yükleme başarısızsa hiçbir şey kaydedilmez, sunucudaki portföy boş listeyle ezilmez.
export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PortfolioStatus>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef<Position[]>([]);
  const statusRef = useRef<PortfolioStatus>("loading");
  const saving = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    getPortfolio(getToken() ?? "").then(
      (list) => {
        if (!alive) return;
        ref.current = list;
        statusRef.current = "ready";
        setPositions(list);
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
          await savePortfolio(getToken() ?? "", ref.current);
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

  const commit = useCallback(
    (next: Position[]) => {
      ref.current = next;
      setPositions(next);
      void flush();
    },
    [flush],
  );

  const add = useCallback(
    (symbol: string, qty: number, cost: number) => {
      if (statusRef.current !== "ready" || !(qty > 0) || !(cost > 0)) return;
      const cur = ref.current;
      if (!cur.some((p) => p.symbol === symbol) && cur.length >= MAX_POSITIONS) return;
      commit(mergeLot(cur, symbol, qty, cost));
    },
    [commit],
  );

  const set = useCallback(
    (symbol: string, qty: number, cost: number) => {
      if (statusRef.current !== "ready" || !(qty > 0) || !(cost > 0)) return;
      const cur = ref.current;
      if (!cur.some((p) => p.symbol === symbol)) return;
      commit(cur.map((p) => (p.symbol === symbol ? { symbol, qty, cost } : p)));
    },
    [commit],
  );

  const remove = useCallback(
    (symbol: string) => {
      if (statusRef.current !== "ready") return;
      const cur = ref.current;
      if (!cur.some((p) => p.symbol === symbol)) return;
      commit(cur.filter((p) => p.symbol !== symbol));
    },
    [commit],
  );

  const value = useMemo<PortfolioValue>(
    () => ({ positions, status, saveFailed, full: positions.length >= MAX_POSITIONS, add, set, remove }),
    [positions, status, saveFailed, add, set, remove],
  );
  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioValue {
  return useContext(PortfolioContext);
}
