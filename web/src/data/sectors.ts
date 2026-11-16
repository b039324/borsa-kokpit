// BIST 100 hisselerinin KAP alt sektör endekslerine göre sektör eşleşmesi.
// Kaynak: KAP "Endeksler Listesi" (16.11.2026). Bir hisse tek sektörde; hiçbirine girmeyenler "Diğer".
// Çeyrek revizyonunda (Ocak/Nisan/Temmuz/Ekim) BIST 100 listesiyle birlikte KAP'tan yenilenir.
export const SECTORS: Record<string, string[]> = {
  "Banka": ["AKBNK", "ALBRK", "GARAN", "HALKB", "ISCTR", "TSKB", "VAKBN", "YKBNK"],
  "Sigorta": ["ANHYT", "ANSGR", "TURSG"],
  "Holding ve yatırım": ["AGHOL", "ALARK", "BERA", "BINHO", "BRYAT", "DOHOL", "ECILC", "ECZYT", "GLYHO", "KCHOL", "PAHOL", "SAHOL", "SISE", "TAVHL", "TKFEN"],
  "GYO": ["EKGYO", "SNGYO", "TRGYO"],
  "Aracı kurum": ["ISMEN"],
  "Gıda ve içecek": ["AEFES", "CCOLA", "OBAMS", "TUKAS", "ULKER"],
  "Kimya, petrol, plastik": ["AKSA", "AYGAZ", "EGGUB", "EUREN", "GUBRF", "HEKTS", "PETKM", "SASA", "TUPRS"],
  "Madencilik": ["CVKMD", "TRALT", "TRENJ", "TRMET"],
  "Metal ana": ["BRSAN", "EREGL", "ISDMR", "KCAER", "KRDMD", "TCKRC"],
  "Metal eşya, makina": ["ARCLK", "ASTOR", "EGEEN", "FROTO", "KARSN", "KATMR", "OTKAR", "TOASO", "TTRAK", "VESTL"],
  "Taş, toprak": ["AKCNS", "BTCIM", "CIMSA", "LMKDC", "OYAKC"],
  "Tekstil, deri": ["KORDS"],
  "Elektrik": ["AHGAZ", "AKFYE", "AKSEN", "CANTE", "CWENE", "ENERY", "ENJSA", "ENTRA", "GWIND", "ODAS", "ZOREN"],
  "İletişim": ["TCELL", "TTKOM"],
  "İnşaat": ["ENKAI", "GLRMK"],
  "Spor": ["FENER"],
  "Ticaret": ["BIMAS", "DOAS", "MAVI", "MGROS", "SOKM"],
  "Turizm": ["TABGD"],
  "Ulaştırma": ["GRSEL", "PGSUS", "RYSAS", "THYAO"],
  "Teknoloji": ["ALTNY", "ASELS"],
  "Diğer": ["MPARK", "RGYAS"],
};
