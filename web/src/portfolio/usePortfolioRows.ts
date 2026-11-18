import { useMemo } from "react";
import { useQuotes } from "../hooks/useQuotes";
import { buildPortfolio } from "./calc";
import { usePortfolio } from "./PortfolioProvider";

// Portföy modüllerinin ortak verisi: pozisyonlar + güncel fiyatlar → satırlar ve toplamlar.
export function usePortfolioRows() {
  const { positions, status, saveFailed } = usePortfolio();
  const { quotes, failed, loading, error } = useQuotes(positions.map((p) => p.symbol));
  const built = useMemo(() => buildPortfolio(positions, quotes), [positions, quotes]);
  return { ...built, positions, status, saveFailed, failed, loading, error };
}
