import type { Alarm, QuoteItem } from "../api";

// Yukarı alarm: fiyat hedefe eşit/üstünde; aşağı alarm: eşit/altında.
export function isTriggered(a: Alarm, price: number): boolean {
  return a.dir === "above" ? price >= a.price : price <= a.price;
}

export const describeAlarm = (a: Alarm): string => (a.dir === "above" ? "Üstüne çıkınca" : "Altına inince");

export interface EvalResult {
  alarms: Alarm[];
  fired: { alarm: Alarm; price: number }[];
  changed: boolean;
}

// Aktif (tetiklenmemiş) alarmları güncel fiyatlarla karşılaştırır; tetiklenenleri `now` ile işaretler.
export function evaluateAlarms(alarms: Alarm[], quotes: Record<string, QuoteItem>, now: number): EvalResult {
  const fired: EvalResult["fired"] = [];
  const next = alarms.map((a) => {
    if (a.triggeredAt !== null) return a;
    const price = quotes[a.symbol]?.price;
    if (typeof price !== "number" || !isTriggered(a, price)) return a;
    const hit = { ...a, triggeredAt: now };
    fired.push({ alarm: hit, price });
    return hit;
  });
  return { alarms: next, fired, changed: fired.length > 0 };
}
