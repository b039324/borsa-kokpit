import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message = "Sunucuya ulaşılamadı") {
    super(message);
    this.name = "NetworkError";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new NetworkError();
  }
}

export async function login(
  password: string,
): Promise<{ token: string; expiresIn: number }> {
  const res = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return res.json();
  let message = "Giriş yapılamadı";
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    /* varsayılan mesaj kalır */
  }
  throw new ApiError(res.status, message);
}

// Kayıtlı düzeni getirir. Kayıt yoksa null. Gelen veri ham döner; doğrulama çağıranda.
export async function getLayout(token: string): Promise<unknown> {
  const res = await request("/api/layout", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(res.status, "Düzen alınamadı");
  const body = (await res.json()) as { layout?: unknown };
  return body.layout ?? null;
}

export async function saveLayout(token: string, layout: unknown): Promise<void> {
  const res = await request("/api/layout", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new ApiError(res.status, "Düzen kaydedilemedi");
}

// true: oturum geçerli, false: token geçersiz/süresi dolmuş, hata: sunucu sorunu
export async function checkSession(token: string): Promise<boolean> {
  const res = await request("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return true;
  if (res.status === 401) return false;
  throw new ApiError(res.status, "Sunucu hatası");
}

export interface SearchHit {
  symbol: string;
  name: string;
}

export async function searchSymbols(
  token: string,
  q: string,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const res = await request(`/api/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new ApiError(res.status, "Arama başarısız");
  const body = (await res.json()) as { results?: SearchHit[] };
  return body.results ?? [];
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ChartData {
  symbol: string;
  period: string;
  currency: string | null;
  price: number | null;
  prevClose: number | null;
  gmtoffset: number;
  candles: Candle[];
}

export async function getChart(
  token: string,
  symbol: string,
  period: string,
  signal?: AbortSignal,
): Promise<ChartData> {
  const res = await request(
    `/api/chart?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`,
    { headers: { Authorization: `Bearer ${token}` }, signal },
  );
  if (res.status === 404) throw new ApiError(404, "Hisse bulunamadı");
  if (!res.ok) throw new ApiError(res.status, "Veri alınamadı");
  return (await res.json()) as ChartData;
}

export interface Fundamentals {
  symbol: string;
  name: string | null;
  currency: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  enterpriseToEbitda: number | null;
  trailingEps: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
}

export async function getFundamentals(token: string, symbol: string, signal?: AbortSignal): Promise<Fundamentals> {
  const res = await request(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (res.status === 404) throw new ApiError(404, "Hisse bulunamadı");
  if (!res.ok) throw new ApiError(res.status, "Temel veri alınamadı");
  return (await res.json()) as Fundamentals;
}

export interface Alarm {
  id: string;
  symbol: string;
  dir: "above" | "below";
  price: number;
  createdAt: number;
  triggeredAt: number | null;
}

export async function getAlarms(token: string): Promise<Alarm[]> {
  const res = await request("/api/alarms", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(res.status, "Alarmlar alınamadı");
  const body = (await res.json()) as { alarms?: Alarm[] };
  return Array.isArray(body.alarms) ? body.alarms : [];
}

export async function saveAlarms(token: string, alarms: Alarm[]): Promise<void> {
  const res = await request("/api/alarms", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ alarms }),
  });
  if (!res.ok) throw new ApiError(res.status, "Alarmlar kaydedilemedi");
}

export async function getFavorites(token: string): Promise<string[]> {
  const res = await request("/api/favorites", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(res.status, "Favoriler alınamadı");
  const body = (await res.json()) as { symbols?: string[] };
  return Array.isArray(body.symbols) ? body.symbols : [];
}

export async function saveFavorites(token: string, symbols: string[]): Promise<void> {
  const res = await request("/api/favorites", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) throw new ApiError(res.status, "Favoriler kaydedilemedi");
}

export interface QuoteItem {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  volume?: number | null; // gün içi toplam lot
}

export const QUOTES_PER_CALL = 20; // Worker sınırı ile aynı

export async function getQuotes(token: string, symbols: string[], signal?: AbortSignal): Promise<{ quotes: QuoteItem[]; failed: string[] }> {
  const out = { quotes: [] as QuoteItem[], failed: [] as string[] };
  for (let i = 0; i < symbols.length; i += QUOTES_PER_CALL) {
    const chunk = symbols.slice(i, i + QUOTES_PER_CALL);
    const res = await request(`/api/quotes?symbols=${encodeURIComponent(chunk.join(","))}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) throw new ApiError(res.status, "Fiyatlar alınamadı");
    const body = (await res.json()) as { quotes?: QuoteItem[]; failed?: string[] };
    out.quotes.push(...(body.quotes ?? []));
    out.failed.push(...(body.failed ?? []));
  }
  return out;
}

export interface StatsItem {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  volume: number | null; // son seansın toplam lotu
  avgVolume: number | null; // önceki 20 seansın ortalaması
  vol: number | null; // yıllık oynaklık (oran)
}

export async function getStats(token: string, symbols: string[], signal?: AbortSignal): Promise<{ stats: StatsItem[]; failed: string[] }> {
  const out = { stats: [] as StatsItem[], failed: [] as string[] };
  for (let i = 0; i < symbols.length; i += QUOTES_PER_CALL) {
    const chunk = symbols.slice(i, i + QUOTES_PER_CALL);
    const res = await request(`/api/stats?symbols=${encodeURIComponent(chunk.join(","))}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) throw new ApiError(res.status, "İstatistikler alınamadı");
    const body = (await res.json()) as { stats?: StatsItem[]; failed?: string[] };
    out.stats.push(...(body.stats ?? []));
    out.failed.push(...(body.failed ?? []));
  }
  return out;
}

export interface MarketItem {
  key: string;
  label: string;
  decimals: number;
  price: number | null;
  prevClose: number | null;
}

export async function getMarket(token: string, signal?: AbortSignal): Promise<MarketItem[]> {
  const res = await request("/api/market", { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!res.ok) throw new ApiError(res.status, "Piyasa verisi alınamadı");
  const body = (await res.json()) as { items?: MarketItem[] };
  return body.items ?? [];
}
