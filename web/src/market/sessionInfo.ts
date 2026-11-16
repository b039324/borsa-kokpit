import { isMarketOpen } from "./session";

// BIST Pay Piyasası, tam iş günü (Türkiye saati sabit UTC+3). Tüm saatler burada, değiştirmek kolay.
// Kaynak: Borsa İstanbul / aracı kurum seans tabloları. Yarım gün ve resmî tatiller dahil DEĞİL.
export type Phase =
  | "kapali"
  | "acilis-emir"
  | "acilis-fiyat"
  | "surekli"
  | "kapanis-marj"
  | "kapanis-emir"
  | "kapanis-fiyat"
  | "kapanis-islem";

export const SCHEDULE: { phase: Phase; label: string; startMin: number }[] = [
  { phase: "acilis-emir", label: "Açılış emir toplama", startMin: 9 * 60 + 40 },
  { phase: "acilis-fiyat", label: "Açılış fiyat belirleme", startMin: 9 * 60 + 55 },
  { phase: "surekli", label: "Sürekli işlem", startMin: 10 * 60 },
  { phase: "kapanis-marj", label: "Kapanış öncesi", startMin: 18 * 60 },
  { phase: "kapanis-emir", label: "Kapanış emir toplama", startMin: 18 * 60 + 1 },
  { phase: "kapanis-fiyat", label: "Kapanış fiyat belirleme", startMin: 18 * 60 + 5 },
  { phase: "kapanis-islem", label: "Kapanış fiyatından işlem", startMin: 18 * 60 + 8 },
];
const END_MIN = 18 * 60 + 10;
const FIRST = SCHEDULE[0];

export interface SessionInfo {
  phase: Phase;
  label: string;
  nextLabel: string;
  secondsLeft: number; // bir sonraki aşamaya kalan süre
  dataRefreshActive: boolean; // veri yenileme (isMarketOpen) açık mı
}

const DAY = 86400;

export function sessionInfo(now: Date = new Date()): SessionInfo {
  const tr = new Date(now.getTime() + 3 * 3600_000);
  const day = tr.getUTCDay();
  const sec = tr.getUTCHours() * 3600 + tr.getUTCMinutes() * 60 + tr.getUTCSeconds();
  const weekday = day >= 1 && day <= 5;
  const dataRefreshActive = isMarketOpen(now);

  if (weekday) {
    for (let i = SCHEDULE.length - 1; i >= 0; i--) {
      const cur = SCHEDULE[i];
      if (sec >= cur.startMin * 60) {
        const nextStart = i + 1 < SCHEDULE.length ? SCHEDULE[i + 1].startMin : END_MIN;
        if (sec < nextStart * 60) {
          const next = i + 1 < SCHEDULE.length ? SCHEDULE[i + 1].label : "Seans kapalı";
          return { phase: cur.phase, label: cur.label, nextLabel: next, secondsLeft: nextStart * 60 - sec, dataRefreshActive };
        }
        break;
      }
    }
  }

  // Kapalı: bir sonraki iş gününün açılışına kadar
  let daysAhead = 0;
  if (weekday && sec < FIRST.startMin * 60) daysAhead = 0;
  else {
    daysAhead = 1;
    while (![1, 2, 3, 4, 5].includes((day + daysAhead) % 7)) daysAhead++;
  }
  const secondsLeft = daysAhead * DAY + FIRST.startMin * 60 - sec;
  return { phase: "kapali", label: "Seans kapalı", nextLabel: FIRST.label, secondsLeft, dataRefreshActive };
}

export function formatCountdown(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h} sa ${pad(m)} dk ${pad(s)} sn`;
  if (m > 0) return `${m} dk ${pad(s)} sn`;
  return `${s} sn`;
}
