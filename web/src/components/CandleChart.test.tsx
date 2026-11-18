import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CandleChart } from "./CandleChart";

const T0 = Date.UTC(2026, 10, 10, 7, 0, 0) / 1000;
const mk = (vols: number[]) =>
  vols.map((v, i) => ({ t: T0 + i * 300, o: 100, h: 110, l: 90, c: i % 2 ? 95 : 105, v })); // çift: yükselen, tek: düşen

const draw = (vols: number[], volume?: boolean) =>
  render(<CandleChart candles={mk(vols)} gmtoffset={10800} period="1g" w={600} h={300} volume={volume} />);

const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

describe("CandleChart", () => {
  it("hacim kapalıyken hacim çubuğu çizmez", () => {
    draw([10, 20, 30]);
    expect(screen.getAllByTestId("candle")).toHaveLength(3);
    expect(screen.queryAllByTestId("vol-bar")).toHaveLength(0);
  });

  it("hacim açıkken her mum için bir çubuk çizer; yükselen/düşen sınıfları mumla aynı", () => {
    draw([10, 20, 30], true);
    const bars = screen.getAllByTestId("vol-bar");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveClass("up");
    expect(bars[1]).toHaveClass("down");
    expect(bars[2]).toHaveClass("up");
    expect(screen.getAllByTestId("candle")).toHaveLength(3);
  });

  it("çubuk yüksekliği hacimle orantılıdır (en büyük hacim en yüksek çubuk)", () => {
    draw([10, 20, 40], true);
    const h = screen.getAllByTestId("vol-bar").map((b) => num(b, "height"));
    expect(h[2]).toBeGreaterThan(0);
    expect(h[1] / h[2]).toBeCloseTo(0.5, 1);
    expect(h[0] / h[2]).toBeCloseTo(0.25, 1);
  });

  it("çubuklar fiyat alanının altında kalır ve eksen şeridine taşmaz", () => {
    draw([10, 20, 40], true);
    const wickBottom = Math.max(...screen.getAllByTestId("candle").map((c) => num(c.querySelector("line")!, "y2")));
    for (const b of screen.getAllByTestId("vol-bar")) {
      expect(num(b, "y")).toBeGreaterThan(wickBottom);
      expect(num(b, "y") + num(b, "height")).toBeLessThanOrEqual(300 - 20 + 0.01);
    }
  });

  it("hacim açıkken fiyat alanı küçülür (mumlar daha az yer kaplar)", () => {
    const a = draw([10, 20, 30]);
    const without = Math.max(...screen.getAllByTestId("candle").map((c) => num(c.querySelector("line")!, "y2")));
    a.unmount();
    draw([10, 20, 30], true);
    const withVol = Math.max(...screen.getAllByTestId("candle").map((c) => num(c.querySelector("line")!, "y2")));
    expect(withVol).toBeLessThan(without);
  });

  it("tüm hacimler 0 ise çökmez, çubuk yüksekliği 0 olur", () => {
    draw([0, 0], true);
    for (const b of screen.getAllByTestId("vol-bar")) {
      expect(num(b, "height")).toBe(0);
      expect(Number.isNaN(num(b, "y"))).toBe(false);
    }
  });

  it("fare üzerindeyken hacim açıkken bilgi satırında hacim yazar, kapalıyken yazmaz", () => {
    const a = draw([5_000_000, 20], true);
    fireEvent.mouseMove(screen.getByRole("img", { name: "Mum grafiği" }), { clientX: 5 });
    expect(screen.getByTestId("chart-info")).toHaveTextContent("K 105,00 · H 5,00 mn");
    a.unmount();
    draw([5_000_000, 20]);
    fireEvent.mouseMove(screen.getByRole("img", { name: "Mum grafiği" }), { clientX: 5 });
    expect(screen.getByTestId("chart-info")).not.toHaveTextContent("H 5,00 mn");
  });
});
