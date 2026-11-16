// Piyasa özeti kartındaki sabit liste. Kullanıcıdan sembol alınmaz; yeni kalem eklemek için buraya satır ekle.
export interface MarketItem {
  key: string;
  label: string;
  yahoo: string;
  decimals: number;
}

export const MARKET_ITEMS: MarketItem[] = [
  { key: "XU100", label: "BIST 100", yahoo: "XU100.IS", decimals: 2 },
  { key: "XU030", label: "BIST 30", yahoo: "XU030.IS", decimals: 2 },
  { key: "XBANK", label: "BIST Banka", yahoo: "XBANK.IS", decimals: 2 },
  { key: "USDTRY", label: "USD/TRY", yahoo: "USDTRY=X", decimals: 4 },
  { key: "EURTRY", label: "EUR/TRY", yahoo: "EURTRY=X", decimals: 4 },
  { key: "GOLD", label: "Altın (ons, USD)", yahoo: "GC=F", decimals: 2 },
  { key: "BRENT", label: "Brent petrol (USD)", yahoo: "BZ=F", decimals: 2 },
  { key: "SP500", label: "S&P 500", yahoo: "^GSPC", decimals: 2 },
];
