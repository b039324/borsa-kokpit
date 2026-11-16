// BIST seans saatleri (Türkiye saati sabit UTC+3): hafta içi 10:00–18:00.
// Veri ~15 dk gecikmeli geldiği için kapanıştan sonra 18:30'a kadar yenilemeye devam edilir.
// Resmî tatiller dahil DEĞİL (tatilde seans açık sanılır, zararı yalnız gereksiz istektir).
const OPEN_MIN = 10 * 60;
const CLOSE_MIN = 18 * 60 + 30;

export function isMarketOpen(now: Date = new Date()): boolean {
  const tr = new Date(now.getTime() + 3 * 3600_000);
  const day = tr.getUTCDay(); // 0 Pazar, 6 Cumartesi
  if (day === 0 || day === 6) return false;
  const min = tr.getUTCHours() * 60 + tr.getUTCMinutes();
  return min >= OPEN_MIN && min < CLOSE_MIN;
}
