import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FavoritesProvider, useFavorites } from "./favorites";
import { mockFetch, TOKEN_KEY } from "./test/helpers";

function Probe() {
  const f = useFavorites();
  return (
    <div>
      <div data-testid="list">{f.symbols.join(",")}</div>
      <div data-testid="status">{f.status}</div>
      <div data-testid="failed">{String(f.saveFailed)}</div>
      <button onClick={() => f.toggle("THYAO")}>thy</button>
      <button onClick={() => f.toggle("GARAN")}>garan</button>
    </div>
  );
}

function setup(opts: { initial?: string[]; getStatus?: number; putStatuses?: number[] } = {}) {
  const puts: string[][] = [];
  let n = 0;
  const f = mockFetch((u, init) => {
    if (init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)).symbols);
      const st = opts.putStatuses?.[n++] ?? 200;
      return { status: st, body: {} };
    }
    return { status: opts.getStatus ?? 200, body: { symbols: opts.initial ?? [] } };
  });
  render(
    <FavoritesProvider>
      <Probe />
    </FavoritesProvider>,
  );
  return { f, puts };
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("FavoritesProvider", () => {
  it("sunucudaki listeyi yükler", async () => {
    setup({ initial: ["THYAO", "GARAN"] });
    await waitFor(() => expect(screen.getByTestId("list")).toHaveTextContent("THYAO,GARAN"));
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("ekler ve sunucuya kaydeder", async () => {
    const { puts } = setup();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("thy"));
    expect(screen.getByTestId("list")).toHaveTextContent("THYAO");
    await waitFor(() => expect(puts).toEqual([["THYAO"]]));
  });

  it("ikinci tıklama favoriden çıkarır", async () => {
    const { puts } = setup({ initial: ["THYAO"] });
    await waitFor(() => expect(screen.getByTestId("list")).toHaveTextContent("THYAO"));
    await userEvent.click(screen.getByText("thy"));
    expect(screen.getByTestId("list")).toHaveTextContent("");
    await waitFor(() => expect(puts.at(-1)).toEqual([]));
  });

  it("yükleme başarısızsa hiçbir şey kaydetmez (sunucudaki liste ezilmez)", async () => {
    const { puts } = setup({ getStatus: 500 });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    await userEvent.click(screen.getByText("thy"));
    await new Promise((r) => setTimeout(r, 50));
    expect(puts).toEqual([]);
    expect(screen.getByTestId("list")).toHaveTextContent("");
  });

  it("kayıt başarısız olursa liste ekranda kalır ve uyarı işaretlenir", async () => {
    setup({ putStatuses: [500] });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("thy"));
    await waitFor(() => expect(screen.getByTestId("failed")).toHaveTextContent("true"));
    expect(screen.getByTestId("list")).toHaveTextContent("THYAO");
  });

  it("hızlı art arda değişiklikte son hal sunucuya ulaşır", async () => {
    const { puts } = setup();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByText("thy"));
    await userEvent.click(screen.getByText("garan"));
    await waitFor(() => expect(puts.at(-1)).toEqual(["THYAO", "GARAN"]));
  });

  it("Provider yoksa boş liste verir, çökmez", () => {
    render(<Probe />);
    expect(screen.getByTestId("list")).toHaveTextContent("");
  });
});
