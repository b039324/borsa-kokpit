import * as realApi from "../api";
import { isMarketOpen } from "../market/session";
import { SYMBOL_LISTS } from "../data/symbols";
import { PERIODS } from "../components/PeriodBar";
import {
  assessChart, assessDividends, assessFinancials, assessFundamentals, assessList, assessMarket,
  assessQuotes, assessStats,
} from "./assess";
import type { Check, ModuleSpec } from "./types";

type Api = typeof realApi;

const BANK_SAMPLE = "GARAN";
const CHART_IDS = PERIODS.map((p) => `chart-${p.key}`);

export function buildChecks(token: string, sample: string, api: Api = realApi, clock: () => Date = () => new Date()): Check[] {
  const bist30 = SYMBOL_LISTS.BIST30;
  return [
    { id: "market", label: "Piyasa özeti (endeksler, döviz)", run: async () => assessMarket(await api.getMarket(token)) },
    {
      id: "quotes-bist30",
      label: "Fiyatlar (BIST 30)",
      run: async () => {
        const r = await api.getQuotes(token, bist30);
        return assessQuotes(r.quotes, r.failed, bist30.length);
      },
    },
    {
      id: "stats-bist30",
      label: "İstatistikler: RSI, hacim, oynaklık (BIST 30)",
      run: async () => {
        const r = await api.getStats(token, bist30);
        return assessStats(r.stats, r.failed, bist30.length);
      },
    },
    ...PERIODS.map((p) => ({
      id: `chart-${p.key}`,
      label: `Grafik ${p.label} (${sample})`,
      run: async () => {
        const data = await api.getChart(token, sample, p.key);
        const now = clock();
        return assessChart(data, p.label, { now: now.getTime(), marketOpen: isMarketOpen(now) });
      },
    })),
    { id: "fundamentals", label: `Temel veriler (${sample})`, run: async () => assessFundamentals(await api.getFundamentals(token, sample)) },
    { id: "financials", label: `Finansal tablo (${sample})`, run: async () => assessFinancials(await api.getFinancials(token, sample), false) },
    { id: "financials-bank", label: `Finansal tablo, banka (${BANK_SAMPLE})`, run: async () => assessFinancials(await api.getFinancials(token, BANK_SAMPLE), true) },
    { id: "dividends", label: `Temettü ve bölünme (${sample})`, run: async () => assessDividends(await api.getDividends(token, sample)) },
    { id: "favorites", label: "Favoriler (sunucu)", run: async () => assessList(await api.getFavorites(token), "favori") },
    { id: "alarms", label: "Alarmlar (sunucu)", run: async () => assessList(await api.getAlarms(token), "alarm") },
    { id: "portfolio", label: "Portföy (sunucu, yalnız okuma)", run: async () => assessList(await api.getPortfolio(token), "pozisyon") },
    {
      id: "layout",
      label: "Düzen kaydı (sunucu)",
      run: async () => {
        const l = await api.getLayout(token);
        return l && typeof l === "object" ? { status: "ok", detail: "Kayıtlı düzen okundu" } : { status: "ok", detail: "Kayıtlı düzen yok (ilk kullanım)" };
      },
    },
    {
      id: "search",
      label: "Hisse arama",
      run: async () => {
        const hits = await api.searchSymbols(token, "AKB");
        return hits.length > 0 ? { status: "ok", detail: `${hits.length} sonuç` } : { status: "fail", detail: "Arama sonuç döndürmedi" };
      },
    },
    {
      id: "session",
      label: "Oturum",
      run: async () => ((await api.checkSession(token)) ? { status: "ok", detail: "Oturum geçerli" } : { status: "fail", detail: "Oturum geçersiz" }),
    },
    {
      id: "youtube",
      label: "YouTube canlı yayın",
      run: async () => ({ status: "manual", detail: "Tarayıcı kuralları yüzünden otomatik doğrulanamaz; modülü açıp izle" }),
    },
  ];
}

// Her modülün bağlı olduğu kontroller. Yeni modül eklenince buraya da eklenmeli (test zorlar).
export const MODULE_CHECKS: Record<string, string[]> = {
  "canli-yayin": ["youtube"],
  "coklu-grafik": CHART_IDS,
  "destek-direnc": CHART_IDS,
  "en-cok-hareket": ["quotes-bist30"],
  "endeks-ozet": ["market"],
  favori: ["favorites", "quotes-bist30"],
  "finansal-tablo": ["financials", "financials-bank"],
  "fiyat-alarmi": ["alarms", "quotes-bist30"],
  "fiyat-ozeti": CHART_IDS,
  "getiri-donemleri": CHART_IDS,
  "goreli-guc": CHART_IDS,
  grafik: CHART_IDS,
  "hacim-patlamasi": ["stats-bist30"],
  "hacim-tl": CHART_IDS,
  "isi-haritasi": ["quotes-bist30"],
  karsilastirma: CHART_IDS,
  "mum-formasyonu": CHART_IDS,
  "ornek-hisse": [],
  "ornek-saat": [],
  "piyasa-genisligi": ["quotes-bist30"],
  "portfoy-dagilim": ["portfolio", "quotes-bist30"],
  "portfoy-ozet": ["portfolio", "quotes-bist30"],
  "portfoy-pozisyonlar": ["portfolio", "quotes-bist30"],
  "pozisyon-hesaplayici": ["quotes-bist30"],
  risk: CHART_IDS,
  "seans-durumu": [],
  sektor: ["quotes-bist30"],
  sinyal: CHART_IDS,
  tarayici: ["stats-bist30"],
  "sinyal-listesi": ["stats-bist30"],
  "al-sat-botu": ["stats-bist30"],
  "teknik-bant": CHART_IDS,
  teknik: CHART_IDS,
  temel: ["fundamentals"],
  "temettu-bolunme": ["dividends", "quotes-bist30"],
  "volatilite-siralamasi": ["stats-bist30"],
};

export function buildModuleSpecs(defs: { id: string; title: string }[]): ModuleSpec[] {
  return defs.map((d) => ({ id: d.id, title: d.title, checks: MODULE_CHECKS[d.id] ?? [] }));
}
