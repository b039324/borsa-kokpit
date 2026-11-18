import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioProvider, usePortfolio } from "./PortfolioProvider";
import { apiMock, TOKEN_KEY } from "../test/helpers";

function Probe() {
  const p = usePortfolio();
  return (
    <div>
      <span data-testid="status">{p.status}</span>
      <span data-testid="failed">{String(p.saveFailed)}</span>
      <span data-testid="list">{p.positions.map((x) => `${x.symbol}:${x.qty}@${x.cost}`).join(",")}</span>
      <button onClick={() => p.add("AAA", 50, 16)}>ekle</button>
      <button onClick={() => p.add("ZZZ", 1, 5)}>yeni</button>
      <button onClick={() => p.set("AAA", 7, 9)}>düzenle</button>
      <button onClick={() => p.remove("AAA")}>sil</button>
    </div>
  );
}
const mount = () =>
  render(
    <PortfolioProvider>
      <Probe />
    </PortfolioProvider>,
  );

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

const seed = [{ symbol: "AAA", qty: 100, cost: 10 }];

describe("PortfolioProvider", () => {
  it("sunucudaki pozisyonları yükler", async () => {
    apiMock({ portfolio: seed });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("list")).toHaveTextContent("AAA:100@10");
  });

  it("add: aynı sembolde ağırlıklı ortalama, sunucuya kaydeder", async () => {
    const m = apiMock({ portfolio: seed });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("ekle"));
    expect(screen.getByTestId("list")).toHaveTextContent("AAA:150@12");
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toEqual([{ symbol: "AAA", qty: 150, cost: 12 }]));
  });

  it("add: yeni sembol sona eklenir", async () => {
    const m = apiMock({ portfolio: seed });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("yeni"));
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toHaveLength(2));
    expect(m.portfolioPuts.at(-1)![1]).toEqual({ symbol: "ZZZ", qty: 1, cost: 5 });
  });

  it("set: adet ve maliyeti doğrudan değiştirir (birleştirmez)", async () => {
    const m = apiMock({ portfolio: seed });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("düzenle"));
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toEqual([{ symbol: "AAA", qty: 7, cost: 9 }]));
  });

  it("remove: pozisyonu siler ve kaydeder", async () => {
    const m = apiMock({ portfolio: seed });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("sil"));
    expect(screen.getByTestId("list")).toHaveTextContent("");
    await waitFor(() => expect(m.portfolioPuts.at(-1)).toEqual([]));
  });

  it("yükleme başarısızsa durum 'error' ve hiçbir şey kaydedilmez (sunucudaki veri ezilmez)", async () => {
    const m = apiMock({ portfolio: seed, portfolioGetStatus: 500 });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    await userEvent.click(screen.getByText("yeni"));
    await userEvent.click(screen.getByText("sil"));
    expect(m.portfolioPuts).toHaveLength(0);
  });

  it("kayıt başarısızsa liste ekranda güncel kalır, saveFailed true olur", async () => {
    apiMock({ portfolio: seed, portfolioPutStatus: 500 });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("yeni"));
    expect(screen.getByTestId("list")).toHaveTextContent("ZZZ:1@5");
    await waitFor(() => expect(screen.getByTestId("failed")).toHaveTextContent("true"));
  });

  it("bileşen kapanıp yeniden açılınca veri sunucudan geri gelir (sekme/modül kapatmak veriyi silmez)", async () => {
    apiMock({ portfolio: seed });
    const first = mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("yeni"));
    await waitFor(() => expect(screen.getByTestId("failed")).toHaveTextContent("false"));
    await new Promise((r) => setTimeout(r, 20));
    first.unmount();
    mount();
    await waitFor(() => expect(screen.getByTestId("list")).toHaveTextContent("AAA:100@10,ZZZ:1@5"));
  });
});
