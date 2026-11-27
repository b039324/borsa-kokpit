import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def, { BOT_KEY } from "./al-sat-botu.module";
import { SelectionProvider, useSelection } from "../selection";
import { SYMBOL_LISTS } from "../data/symbols";
import { apiMock, TOKEN_KEY } from "../test/helpers";
import { DEFAULT_CONFIG, newState, type BotState } from "../bot/engine";

const Comp = def.component;
const Probe = () => <div data-testid="sel">{useSelection().selected ?? "-"}</div>;
const [S1, S2] = SYMBOL_LISTS.BIST30;

// AL: trend yukarı, fiyat>SMA20, RSI nötr, hacim ortalamanın üstünde
const AL = (price: number) => ({ price, prevClose: price, rsi: 50, sma20: price * 0.95, sma50: price * 0.9, volume: 2000, avgVolume: 1000 });
const TUT = (price: number) => ({ price, prevClose: price, rsi: 50, sma20: price * 0.99, sma50: price, volume: 1000, avgVolume: 1000 });

function setup(stats: Record<string, any> = { [S1]: AL(40) }) {
  apiMock({ stats });
  return render(
    <SelectionProvider>
      <Comp symbol={null} />
      <Probe />
    </SelectionProvider>,
  );
}
const saved = (): BotState | null => {
  const raw = localStorage.getItem(BOT_KEY);
  return raw ? JSON.parse(raw) : null;
};
const clockAt = (iso: string) => vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });

beforeEach(() => {
  localStorage.setItem(TOKEN_KEY, "tok");
  clockAt("2026-11-26T10:00:00Z"); // Perşembe 13:00 TR: otomatik tarama zamanı değil
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("al-sat botu modülü (simülasyon)", () => {
  it("tanım: hisseden bağımsız, simülasyon olduğu başlıkta yazar", () => {
    expect(def.id).toBe("al-sat-botu");
    expect(def.scope).toBe("global");
    expect(def.title).toMatch(/simülasyon/i);
  });

  it("ilk açılışta 150.000 TL nakit, işlem yok, pozisyon yok", async () => {
    setup();
    expect(await screen.findByTestId("bot-cash")).toHaveTextContent("150.000,00");
    expect(screen.getByTestId("bot-equity")).toHaveTextContent("150.000,00");
    expect(screen.getByText(/Açık pozisyon yok/)).toBeInTheDocument();
    expect(screen.getByText(/Henüz kapanan işlem yok/)).toBeInTheDocument();
    expect(screen.getByText(/gerçek para yok/i)).toBeInTheDocument();
  });

  it("'Şimdi tara' AL hissesini alır: pozisyon satırı, düşen nakit, kayıt", async () => {
    setup();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Şimdi tara" }));
    const rows = await screen.findAllByTestId("bot-pos");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(S1);
    expect(rows[0]).toHaveTextContent("374"); // 15.000 / (40 × 1,001)
    expect(screen.getByTestId("bot-cash")).toHaveTextContent("135.025,04"); // 150.000 − 374×40×1,001
    expect(saved()!.positions).toHaveLength(1);
    expect(saved()!.lastRunDate).toBe("2026-11-26");
  });

  it("gün içinde (seans açık) hacim ortalamanın altında görünse de AL hissesi alınır", async () => {
    // varsayılan saat: Perşembe 13:00 TR, seans açık
    setup({ [S1]: { ...AL(40), volume: 200, avgVolume: 1000 } });
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Şimdi tara" }));
    expect(await screen.findAllByTestId("bot-pos")).toHaveLength(1);
    expect(screen.getByTestId("bot-scan")).toHaveTextContent(/hacim filtresi seans bitince/i);
  });

  it("seans kapalıyken düşük hacimli AL elenir ve özet nedenini söyler", async () => {
    vi.setSystemTime(new Date("2026-11-26T16:00:00Z")); // 19:00 TR, seans kapalı
    localStorage.setItem(BOT_KEY, JSON.stringify({ ...newState(DEFAULT_CONFIG, "2026-11-20"), lastRunDate: "2026-11-26" }));
    setup({ [S1]: { ...AL(40), volume: 200, avgVolume: 1000 } });
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Şimdi tara" }));
    const scan = await screen.findByTestId("bot-scan");
    expect(scan).toHaveTextContent("1 AL sinyali");
    expect(scan).toHaveTextContent("hacimden 1");
    expect(screen.queryAllByTestId("bot-pos")).toHaveLength(0);
  });

  it("veri gelmeden 'Şimdi tara' kapalıdır", async () => {
    apiMock({ stats: {} });
    render(
      <SelectionProvider>
        <Comp symbol={null} />
      </SelectionProvider>,
    );
    expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeDisabled();
    await vi.waitFor(() => expect(screen.getByText(/Son tarama|alınamadı|Veri/)).toBeInTheDocument());
  });

  it("iş günü 18:15'ten sonra veri gelince kendiliğinden tarar", async () => {
    vi.setSystemTime(new Date("2026-11-26T15:20:00Z")); // 18:20 TR
    setup();
    expect(await screen.findAllByTestId("bot-pos")).toHaveLength(1);
    expect(saved()!.lastRunDate).toBe("2026-11-26");
  });

  it("18:15'ten önce kendiliğinden taramaz", async () => {
    vi.setSystemTime(new Date("2026-11-26T15:10:00Z")); // 18:10 TR
    setup();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    expect(screen.queryAllByTestId("bot-pos")).toHaveLength(0);
  });

  it("aynı gün ikinci kez kendiliğinden taramaz", async () => {
    vi.setSystemTime(new Date("2026-11-26T15:30:00Z"));
    localStorage.setItem(BOT_KEY, JSON.stringify({ ...newState(DEFAULT_CONFIG, "2026-11-20"), lastRunDate: "2026-11-26" }));
    setup();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    expect(screen.queryAllByTestId("bot-pos")).toHaveLength(0);
  });

  it("durum tarayıcıda saklanır; yeniden açılınca pozisyonlar geri gelir", async () => {
    const first = setup();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Şimdi tara" }));
    await screen.findAllByTestId("bot-pos");
    first.unmount();
    setup();
    expect(await screen.findAllByTestId("bot-pos")).toHaveLength(1);
  });

  it("bozuk kayıt yeni hesapla başlar, çökmez", async () => {
    localStorage.setItem(BOT_KEY, "{bozuk");
    setup();
    expect(await screen.findByTestId("bot-cash")).toHaveTextContent("150.000,00");
  });

  it("kapanan işlem tablosu: satış nedeni ve net kâr/zarar görünür", async () => {
    const st: BotState = {
      ...newState(DEFAULT_CONFIG, "2026-11-20"),
      trades: [{ symbol: S2, qty: 100, buyPrice: 10, sellPrice: 11, buyDate: "2026-11-24", sellDate: "2026-11-25", reason: "Kâr al", pnl: 97.9, pnlPct: 9.79 }],
    };
    localStorage.setItem(BOT_KEY, JSON.stringify(st));
    setup();
    const row = await screen.findByTestId("bot-trade");
    expect(row).toHaveTextContent(S2);
    expect(row).toHaveTextContent("Kâr al");
    expect(row).toHaveTextContent("97,90");
    expect(screen.getByTestId("bot-winrate")).toHaveTextContent("100");
  });

  it("açık pozisyonun güncel fiyatla kâr/zararı gösterilir", async () => {
    const st = { ...newState(DEFAULT_CONFIG, "2026-11-20"), cash: 100_000, positions: [{ symbol: S1, qty: 100, buyPrice: 40, buyDate: "2026-11-25", buyFee: 4 }] };
    localStorage.setItem(BOT_KEY, JSON.stringify(st));
    setup({ [S1]: TUT(42) }); // +%5
    const row = await screen.findByTestId("bot-pos");
    expect(row).toHaveTextContent("42,00");
    expect(row).toHaveTextContent("+5,00%");
  });

  it("pozisyon satırına tıklayınca hisse seçilir", async () => {
    const st = { ...newState(DEFAULT_CONFIG, "2026-11-20"), cash: 100_000, positions: [{ symbol: S1, qty: 100, buyPrice: 40, buyDate: "2026-11-25", buyFee: 4 }] };
    localStorage.setItem(BOT_KEY, JSON.stringify(st));
    setup({ [S1]: TUT(42) });
    await userEvent.click(within(await screen.findByTestId("bot-pos")).getByRole("button", { name: S1 }));
    expect(screen.getByTestId("sel")).toHaveTextContent(S1);
  });

  it("'Sıfırla' onaydan sonra hesabı başa döndürür; vazgeçilirse dokunmaz", async () => {
    setup();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Şimdi tara" }));
    await screen.findAllByTestId("bot-pos");
    vi.stubGlobal("confirm", () => false);
    await userEvent.click(screen.getByRole("button", { name: "Sıfırla" }));
    expect(screen.getAllByTestId("bot-pos")).toHaveLength(1);
    vi.stubGlobal("confirm", () => true);
    await userEvent.click(screen.getByRole("button", { name: "Sıfırla" }));
    expect(screen.queryAllByTestId("bot-pos")).toHaveLength(0);
    expect(screen.getByTestId("bot-cash")).toHaveTextContent("150.000,00");
    expect(saved()!.positions).toHaveLength(0);
  });

  it("ayar: işlem başı tutar değişince bir sonraki alış ona göre yapılır ve ayar saklanır", async () => {
    setup();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Şimdi tara" })).toBeEnabled());
    const input = screen.getByLabelText("İşlem başı tutar (TL)");
    await userEvent.clear(input);
    await userEvent.type(input, "8000");
    await userEvent.click(screen.getByRole("button", { name: "Şimdi tara" }));
    const row = await screen.findByTestId("bot-pos");
    expect(row).toHaveTextContent("199"); // 8.000 / (40 × 1,001)
    expect(saved()!.config.perTrade).toBe(8000);
  });

  it("ayar: geçersiz (0 veya negatif) değer kabul edilmez", async () => {
    setup();
    const input = await screen.findByLabelText("İşlem başı tutar (TL)");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    expect(saved()?.config.perTrade ?? 15_000).toBe(15_000);
  });

  it("CSV: kapanan işlemleri başlık satırıyla dışa aktarır", async () => {
    const st: BotState = {
      ...newState(DEFAULT_CONFIG, "2026-11-20"),
      trades: [{ symbol: S2, qty: 100, buyPrice: 10, sellPrice: 11, buyDate: "2026-11-24", sellDate: "2026-11-25", reason: "Kâr al", pnl: 97.9, pnlPct: 9.79 }],
    };
    localStorage.setItem(BOT_KEY, JSON.stringify(st));
    let blob: Blob | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { ...URL, createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL: () => {} });
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "CSV indir" }));
    expect(blob).not.toBeNull();
    const text = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsText(blob!);
    });
    expect(text).toContain("Hisse;Adet;Alış tarihi;Alış fiyatı;Satış tarihi;Satış fiyatı;Neden;Net K/Z (TL);Net K/Z (%)");
    expect(text).toContain(`${S2};100;2026-11-24;10;2026-11-25;11;Kâr al;97,9;9,79`);
  });
});
