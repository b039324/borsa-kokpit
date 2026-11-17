// "12,5", "12.5" ve "100 000" biçimlerini sayıya çevirir; pozitif ve sonlu değilse null.
export function parseNum(text: string): number | null {
  const n = Number(text.replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface PositionInput {
  capital: number | null; // TL
  riskPct: number | null; // sermayenin yüzde kaçı riske edilecek
  entry: number | null;
  stop: number | null;
  target: number | null;
}

export interface PositionResult {
  side: "al" | "sat"; // stop girişin altında = alım, üstünde = açığa satış
  riskPerShare: number;
  rewardPerShare: number | null;
  rr: number | null; // ödül / risk
  riskTl: number;
  shares: number;
  value: number;
  valuePct: number;
  lossTl: number;
  gainTl: number | null;
  targetOk: boolean;
  exceedsCapital: boolean;
  maxSharesByCapital: number;
}

// Pozisyon büyüklüğü: risk tutarını hisse başı riske bölüp adedi aşağı yuvarlar.
export function calcPosition(i: PositionInput): PositionResult | null {
  const { capital, riskPct, entry, stop, target } = i;
  if (capital === null || riskPct === null || entry === null || stop === null) return null;
  if (stop === entry || riskPct > 100) return null;

  const side = stop < entry ? "al" : "sat";
  const riskPerShare = Math.abs(entry - stop);
  const riskTl = (capital * riskPct) / 100;
  const shares = Math.floor(riskTl / riskPerShare);
  const value = shares * entry;

  const targetOk = target === null || (side === "al" ? target > entry : target < entry);
  const rewardPerShare = target !== null && targetOk ? Math.abs(target - entry) : null;

  return {
    side,
    riskPerShare,
    rewardPerShare,
    rr: rewardPerShare === null ? null : rewardPerShare / riskPerShare,
    riskTl,
    shares,
    value,
    valuePct: (value / capital) * 100,
    lossTl: shares * riskPerShare,
    gainTl: rewardPerShare === null ? null : shares * rewardPerShare,
    targetOk,
    exceedsCapital: value > capital,
    maxSharesByCapital: Math.floor(capital / entry),
  };
}
