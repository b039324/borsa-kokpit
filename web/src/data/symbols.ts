// BIST 30 ve BIST 100 listeleri. Yahoo'da endeks bileşen listesi yok; listeler elle güncellenir.
// Kaynak: KAP "Endeksler Listesi" (kap.org.tr/tr/Endeksler), 16.11.2026 tarihli dışa aktarım.
// Borsa İstanbul her çeyrek revize eder (Ocak, Nisan, Temmuz, Ekim): KAP'tan yeni Excel alınıp bu dosya yenilenir.
// Kodlar .IS eki olmadan.
export type ListKey = "BIST30" | "BIST100";

const BIST30 = [
  "AEFES", "AKBNK", "ASELS", "ASTOR", "BIMAS", "EKGYO", "ENKAI", "EREGL", "FROTO", "GARAN",
  "GUBRF", "ISCTR", "KCHOL", "KRDMD", "MGROS", "PETKM", "PGSUS", "SAHOL", "SASA", "SISE",
  "TAVHL", "TCELL", "THYAO", "TOASO", "TRALT", "TRMET", "TTKOM", "TUPRS", "VAKBN", "YKBNK",
];

const BIST100 = [
  "AEFES", "AGHOL", "AHGAZ", "AKBNK", "AKCNS", "AKFYE", "AKSA", "AKSEN", "ALARK", "ALBRK",
  "ALTNY", "ANHYT", "ANSGR", "ARCLK", "ASELS", "ASTOR", "AYGAZ", "BERA", "BIMAS", "BINHO",
  "BRSAN", "BRYAT", "BTCIM", "CANTE", "CCOLA", "CIMSA", "CVKMD", "CWENE", "DOAS", "DOHOL",
  "ECILC", "ECZYT", "EGEEN", "EGGUB", "EKGYO", "ENERY", "ENJSA", "ENKAI", "ENTRA", "EREGL",
  "EUREN", "FENER", "FROTO", "GARAN", "GLRMK", "GLYHO", "GRSEL", "GUBRF", "GWIND", "HALKB",
  "HEKTS", "ISCTR", "ISDMR", "ISMEN", "KARSN", "KATMR", "KCAER", "KCHOL", "KORDS", "KRDMD",
  "LMKDC", "MAVI", "MGROS", "MPARK", "OBAMS", "ODAS", "OTKAR", "OYAKC", "PAHOL", "PETKM",
  "PGSUS", "RGYAS", "RYSAS", "SAHOL", "SASA", "SISE", "SNGYO", "SOKM", "TABGD", "TAVHL",
  "TCELL", "TCKRC", "THYAO", "TKFEN", "TOASO", "TRALT", "TRENJ", "TRGYO", "TRMET", "TSKB",
  "TTKOM", "TTRAK", "TUKAS", "TUPRS", "TURSG", "ULKER", "VAKBN", "VESTL", "YKBNK", "ZOREN",
];

export const SYMBOL_LISTS: Record<ListKey, string[]> = { BIST30, BIST100 };
