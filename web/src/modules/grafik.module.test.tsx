import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def, { fmtTime } from "./grafik.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const T0 = Date.UTC(2026, 10, 10, 7, 0, 0) / 1000; // 10:00 TR

function bars(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    t: T0 + i * 300, o: 100 + i, h: 103 + i, l: 98 + i, c: i % 2 ? 99 + i : 102 + i, v: 10,
  }));
}
const body = (n: number) => ({
  symbol: "X", period: "1g", currency: "TRY", price: 100, prevClose: 99, gmtoffset: 10800, candles: bars(n),
});

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("fmtTime", () => {
  it("gün içi: saat", () => expect(fmtTime(T0, 10800, "1g")).toBe("10:00"));
  it("1 haftalık/aylık: gün.ay saat", () => expect(fmtTime(T0, 10800, "1h")).toBe("10.11 10:00"));
  it("3 ay: gün.ay.yy", () => expect(fmtTime(T0, 10800, "3a")).toBe("10.11.26"));
  it("5 yıl: ay.yıl", () => expect(fmtTime(T0, 10800, "5y")).toBe("11.2026"));
});

describe("grafik modülü", () => {
  it("tanım geçerli", () => {
    expect(def.id).toBe("grafik");
    expect(def.scope).toBe("stock");
  });

  it("her mum için bir gövde çizer; yükselen/düşen sınıfları doğru", async () => {
    mockFetch(() => ({ status: 200, body: body(6) }));
    render(<Comp symbol="THYAO" />);
    const candles = await screen.findAllByTestId("candle");
    expect(candles).toHaveLength(6);
    expect(candles[0]).toHaveClass("up"); // c=102 >= o=100
    expect(candles[1]).toHaveClass("down"); // c=100 < o=101
  });

  it("grafiğin altında her mum için hacim çubuğu çizer", async () => {
    mockFetch(() => ({ status: 200, body: body(6) }));
    render(<Comp symbol="THYAO" />);
    await screen.findAllByTestId("candle");
    expect(screen.getAllByTestId("vol-bar")).toHaveLength(6);
  });

  it("21 mumdan azsa SMA çizgisi boş, 50'den azsa yalnız SMA 21 dolu", async () => {
    mockFetch(() => ({ status: 200, body: body(30) }));
    render(<Comp symbol="THYAO" />);
    await screen.findAllByTestId("candle");
    expect(screen.getByTestId("sma21").getAttribute("d")).toMatch(/^M/);
    expect(screen.getByTestId("sma50").getAttribute("d")).toBe("");
  });

  it("varsayılan dönem 1G; düğmeye basınca o dönem istenir", async () => {
    const f = mockFetch(() => ({ status: 200, body: body(6) }));
    render(<Comp symbol="THYAO" />);
    await screen.findAllByTestId("candle");
    expect(String(f.mock.calls[0][0])).toContain("period=1g");
    expect(screen.getByRole("button", { name: "1G" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "3A" }));
    expect(screen.getByRole("button", { name: "3A" })).toHaveAttribute("aria-pressed", "true");
    await vi.waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("period=3a"))).toBe(true));
  });

  it("yedi dönem düğmesi var", () => {
    mockFetch(() => ({ status: 200, body: body(2) }));
    render(<Comp symbol="THYAO" />);
    expect(within(screen.getByRole("group", { name: "Dönem" })).getAllByRole("button")).toHaveLength(7);
  });

  it("fare üstüne gelince o mumun ayrıntısı yazılır, çıkınca silinir", async () => {
    mockFetch(() => ({ status: 200, body: body(6) }));
    render(<Comp symbol="THYAO" />);
    await screen.findAllByTestId("candle");
    const svg = screen.getByRole("img", { name: "Mum grafiği" });
    fireEvent.mouseMove(svg, { clientX: 5 }); // en soldaki mum
    expect(screen.getByTestId("chart-info")).toHaveTextContent("10:00 · A 100,00 Y 103,00 D 98,00 K 102,00");
    fireEvent.mouseLeave(svg);
    expect(screen.getByTestId("chart-info")).toHaveTextContent("Fareyi grafiğin üstüne getir");
  });

  it("mum yoksa bilgi verir", async () => {
    mockFetch(() => ({ status: 200, body: body(0) }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findByText("Bu dönem için mum verisi yok.")).toBeInTheDocument();
  });

  it("hata olunca mesaj gösterir", async () => {
    mockFetch(() => ({ status: 404 }));
    render(<Comp symbol="ZZZZ" />);
    expect(await screen.findByText("Hisse bulunamadı")).toBeInTheDocument();
  });

  it("tek mumda ve sabit fiyatta çökmez", async () => {
    mockFetch(() => ({
      status: 200,
      body: { ...body(1), candles: [{ t: T0, o: 10, h: 10, l: 10, c: 10, v: 1 }] },
    }));
    render(<Comp symbol="THYAO" />);
    expect(await screen.findAllByTestId("candle")).toHaveLength(1);
  });
});
