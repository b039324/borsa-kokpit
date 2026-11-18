import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./coklu-grafik.module";
import { mockFetch, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const T0 = Date.UTC(2026, 10, 10, 7, 0, 0) / 1000;
const bars = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: T0 + i * 300, o: 100 + i, h: 103 + i, l: 98 + i, c: 102 + i, v: 10 * (i + 1) }));

function chartUrls(fn: ReturnType<typeof mockFetch>) {
  return fn.mock.calls.map((c) => new URL(String(c[0]), "http://x").searchParams).filter((p) => p.has("symbol"));
}
const reqs = (fn: ReturnType<typeof mockFetch>) => chartUrls(fn).map((p) => `${p.get("symbol")}:${p.get("period")}`);

const ok = (price = 110, prev = 100) => (url: string) => {
  const sym = new URL(url, "http://x").searchParams.get("symbol") ?? "X";
  if (sym === "YOKK") return { status: 404, body: { error: "bulunamadı" } };
  return { status: 200, body: { symbol: sym, period: "3a", currency: "TRY", price, prevClose: prev, gmtoffset: 10800, candles: bars(6) } };
};

beforeEach(() => { localStorage.clear(); localStorage.setItem(TOKEN_KEY, "tok"); });
afterEach(() => vi.unstubAllGlobals());

describe("çoklu grafik modülü", () => {
  it("tanım: global kapsam, id coklu-grafik", () => {
    expect(def.id).toBe("coklu-grafik");
    expect(def.scope).toBe("global");
  });

  it("4 pencere, her birinde hisse kutusu; varsayılan hisseler yazılı", async () => {
    mockFetch(ok());
    render(<Comp symbol={null as never} />);
    for (let i = 1; i <= 4; i++) expect(screen.getByRole("region", { name: `Pencere ${i}` })).toBeInTheDocument();
    expect(screen.getByLabelText("Pencere 1 hisse")).toHaveValue("THYAO");
    expect(screen.getByLabelText("Pencere 2 hisse")).toHaveValue("GARAN");
    expect(screen.getByLabelText("Pencere 3 hisse")).toHaveValue("AKBNK");
    expect(screen.getByLabelText("Pencere 4 hisse")).toHaveValue("ASELS");
  });

  it("her pencere kendi hissesini çeker ve mum + hacim çubuğu çizer", async () => {
    const fn = mockFetch(ok());
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    expect(screen.getAllByTestId("vol-bar")).toHaveLength(24);
    expect(reqs(fn).sort()).toEqual(["AKBNK:3a", "ASELS:3a", "GARAN:3a", "THYAO:3a"]);
  });

  it("hisse kodunu yazıp Enter'a basınca yalnız o pencere yeni hisseyi çeker (büyük harfe çevrilir)", async () => {
    const fn = mockFetch(ok());
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    const box = screen.getByLabelText("Pencere 2 hisse");
    await userEvent.clear(box);
    await userEvent.type(box, "sise{Enter}");
    expect(box).toHaveValue("SISE");
    await waitFor(() => expect(reqs(fn)).toContain("SISE:3a"));
    expect(reqs(fn).filter((r) => r.startsWith("THYAO"))).toHaveLength(1);
  });

  it("dönem butonu yalnız kendi penceresini değiştirir", async () => {
    const fn = mockFetch(ok());
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    const p3 = screen.getByRole("region", { name: "Pencere 3" });
    await userEvent.click(within(p3).getByRole("button", { name: "1G" }));
    expect(within(p3).getByRole("button", { name: "1G" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(reqs(fn)).toContain("AKBNK:1g"));
    const p1 = screen.getByRole("region", { name: "Pencere 1" });
    expect(within(p1).getByRole("button", { name: "3A" })).toHaveAttribute("aria-pressed", "true");
    expect(reqs(fn)).not.toContain("THYAO:1g");
  });

  it("başlıkta son fiyat ve değişim yüzdesi görünür", async () => {
    mockFetch(ok(110, 100));
    render(<Comp symbol={null as never} />);
    const p1 = screen.getByRole("region", { name: "Pencere 1" });
    await waitFor(() => expect(within(p1).getByTestId("mc-price")).toHaveTextContent("110,00"));
    expect(within(p1).getByTestId("mc-chg")).toHaveTextContent("+10,00%");
  });

  it("geçersiz kod hata gösterir ve önceki hisse korunur", async () => {
    const fn = mockFetch(ok());
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    const box = screen.getByLabelText("Pencere 1 hisse");
    await userEvent.clear(box);
    await userEvent.type(box, "A B!{Enter}");
    const p1 = screen.getByRole("region", { name: "Pencere 1" });
    expect(within(p1).getByRole("alert")).toHaveTextContent(/geçersiz/i);
    expect(reqs(fn).filter((r) => r.startsWith("THYAO"))).toHaveLength(1);
    await userEvent.tab(); // blur → geri döner
    expect(box).toHaveValue("THYAO");
  });

  it("boş bırakılırsa 'Hisse kodu yaz.' mesajı çıkar ve istek atılmaz", async () => {
    const fn = mockFetch(ok());
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    const box = screen.getByLabelText("Pencere 4 hisse");
    await userEvent.clear(box);
    await userEvent.type(box, "{Enter}");
    const p4 = screen.getByRole("region", { name: "Pencere 4" });
    expect(within(p4).getByText("Hisse kodu yaz.")).toBeInTheDocument();
    expect(within(p4).queryByTestId("candle")).toBeNull();
    expect(reqs(fn).filter((r) => r.startsWith("ASELS"))).toHaveLength(1);
  });

  it("bir pencere hata verince diğerleri etkilenmez", async () => {
    mockFetch(ok());
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    const box = screen.getByLabelText("Pencere 2 hisse");
    await userEvent.clear(box);
    await userEvent.type(box, "YOKK{Enter}");
    const p2 = screen.getByRole("region", { name: "Pencere 2" });
    await waitFor(() => expect(within(p2).queryByTestId("candle")).toBeNull());
    expect(screen.getAllByTestId("candle")).toHaveLength(18);
  });

  it("seçimler localStorage'a kaydedilir ve yeniden açılınca geri gelir", async () => {
    mockFetch(ok());
    const a = render(<Comp symbol={null as never} />);
    const box = screen.getByLabelText("Pencere 3 hisse");
    await userEvent.clear(box);
    await userEvent.type(box, "EREGL{Enter}");
    await userEvent.click(within(screen.getByRole("region", { name: "Pencere 3" })).getByRole("button", { name: "1Y" }));
    a.unmount();
    render(<Comp symbol={null as never} />);
    expect(screen.getByLabelText("Pencere 3 hisse")).toHaveValue("EREGL");
    expect(within(screen.getByRole("region", { name: "Pencere 3" })).getByRole("button", { name: "1Y" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bozuk kayıt varsayılanlara döner", () => {
    mockFetch(ok());
    localStorage.setItem("kokpit_coklu_grafik", JSON.stringify({ panes: [{ symbol: "<x>", period: "zz" }] }));
    render(<Comp symbol={null as never} />);
    expect(screen.getByLabelText("Pencere 1 hisse")).toHaveValue("THYAO");
    expect(within(screen.getByRole("region", { name: "Pencere 1" })).getByRole("button", { name: "3A" })).toHaveAttribute("aria-pressed", "true");
  });

  it("fiyat null gelirse başlıkta fiyat gösterilmez ama grafik çizilir", async () => {
    mockFetch((url) => {
      const r = ok()(url) as { body: Record<string, unknown> };
      return { status: 200, body: { ...r.body, price: null, prevClose: null } };
    });
    render(<Comp symbol={null as never} />);
    await waitFor(() => expect(screen.getAllByTestId("candle")).toHaveLength(24));
    expect(screen.queryByTestId("mc-price")).toBeNull();
  });
});
