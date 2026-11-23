import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { SelectionProvider, useSelection } from "../selection";
import { FavoritesProvider } from "../favorites";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const LISTS = {
  BIST30: ["THYAO", "ASELS", "GARAN"],
  BIST100: ["THYAO", "ASELS", "GARAN", "SISE", "KCHOL"],
};

function Probe() {
  const { selected } = useSelection();
  return <div data-testid="probe">{selected ?? "yok"}</div>;
}

const noSearch = async () => [];

function setup(lists = LISTS, search: (q: string) => Promise<any[]> = noSearch) {
  render(
    <SelectionProvider>
      <Sidebar lists={lists} search={search} debounceMs={0} />
      <Probe />
    </SelectionProvider>,
  );
}

describe("Sidebar", () => {
  it("varsayılan olarak BIST 30 listesi görünür", () => {
    setup();
    expect(screen.getByRole("tab", { name: "BIST 30", selected: true })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^[A-Z]+$/ })).toHaveLength(3);
  });

  it("BIST 100 sekmesine geçilince liste değişir", async () => {
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "BIST 100" }));
    expect(screen.getByRole("tab", { name: "BIST 100", selected: true })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^[A-Z]+$/ })).toHaveLength(5);
  });

  it("arama kutusu listeyi büyük/küçük harf fark etmeden süzer", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Hisse ara"), "ga");
    const items = screen.getAllByRole("button", { name: /^[A-Z]+$/ });
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("GARAN");
  });

  it("eşleşme yoksa bilgi mesajı çıkar", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Hisse ara"), "zzz");
    expect(screen.getByText("Listede eşleşen hisse yok.")).toBeInTheDocument();
  });

  it("hisseye tıklanınca seçili hisse güncellenir", async () => {
    setup();
    expect(screen.getByTestId("probe")).toHaveTextContent("yok");
    await userEvent.click(screen.getByRole("button", { name: "ASELS" }));
    expect(screen.getByTestId("probe")).toHaveTextContent("ASELS");
    expect(screen.getByRole("button", { name: "ASELS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "THYAO" })).toHaveAttribute("aria-pressed", "false");
  });

  it("liste boşsa yüklenmedi mesajı çıkar", () => {
    setup({ BIST30: [], BIST100: [] });
    expect(screen.getByText("Hisse listesi henüz yüklenmedi.")).toBeInTheDocument();
  });

  it("favoriler bölümü boş durumla görünür", () => {
    setup();
    expect(screen.getByText("Favoriler")).toBeInTheDocument();
    expect(screen.getByText("Henüz favori yok.")).toBeInTheDocument();
  });

  describe("isimle arama (Yahoo)", () => {
    it("tek harfte arama yapmaz", async () => {
      const search = vi.fn(noSearch);
      setup(LISTS, search);
      await userEvent.type(screen.getByLabelText("Hisse ara"), "t");
      expect(search).not.toHaveBeenCalled();
      expect(screen.queryByText("Diğer hisseler")).not.toBeInTheDocument();
    });

    it("listede olmayan hisseleri 'Diğer hisseler' altında gösterir, tıklayınca seçer", async () => {
      const search = vi.fn(async () => [
        { symbol: "TKFEN", name: "TEKFEN HOLDING" },
        { symbol: "THYAO", name: "Turk Hava Yollari" }, // listede zaten var → tekrar gösterilmez
      ]);
      setup(LISTS, search);
      await userEvent.type(screen.getByLabelText("Hisse ara"), "th");
      const other = await screen.findByTitle("TEKFEN HOLDING");
      expect(screen.queryByTitle("Turk Hava Yollari")).not.toBeInTheDocument();
      await userEvent.click(other);
      expect(screen.getByTestId("probe")).toHaveTextContent("TKFEN");
    });

    it("sonuç yoksa bilgi verir", async () => {
      setup();
      await userEvent.type(screen.getByLabelText("Hisse ara"), "zzz");
      expect(await screen.findByText("Başka sonuç yok.")).toBeInTheDocument();
    });

    it("arama hata verirse listeyi bozmadan uyarı gösterir", async () => {
      setup(LISTS, async () => {
        throw new Error("ağ");
      });
      await userEvent.type(screen.getByLabelText("Hisse ara"), "th");
      expect(await screen.findByText("Arama başarısız.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "THYAO" })).toBeInTheDocument();
    });

    it("hızlı yazarken yalnız son metin aranır (bekleme süresi)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const search = vi.fn(noSearch);
      render(
        <SelectionProvider>
          <Sidebar lists={LISTS} search={search} debounceMs={350} />
        </SelectionProvider>,
      );
      await userEvent.type(screen.getByLabelText("Hisse ara"), "tekfen");
      expect(search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(400);
      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith("tekfen");
      vi.useRealTimers();
    });
  });

  describe("favoriler", () => {
    function setupFav(favorites: string[] = []) {
      localStorage.setItem(TOKEN_KEY, "tok");
      const api = apiMock({ favorites });
      render(
        <SelectionProvider>
          <FavoritesProvider>
            <Sidebar lists={LISTS} search={noSearch} debounceMs={0} />
            <Probe />
          </FavoritesProvider>
        </SelectionProvider>,
      );
      return api;
    }

    it("yıldıza basınca favoriye ekler, Favoriler bölümünde görünür ve kaydedilir", async () => {
      const { favPuts } = setupFav();
      await userEvent.click(await screen.findByRole("button", { name: "ASELS favoriye ekle" }));
      // Aynı hisse hem listede hem Favoriler bölümünde: iki yıldız, ikisi de dolu
      const stars = screen.getAllByRole("button", { name: "ASELS favoriden çıkar" });
      expect(stars).toHaveLength(2);
      stars.forEach((b) => expect(b).toHaveAttribute("aria-pressed", "true"));
      expect(screen.getByLabelText("Favoriler")).toHaveTextContent("ASELS");
      expect(screen.queryByText("Henüz favori yok.")).not.toBeInTheDocument();
      await vi.waitFor(() => expect(favPuts.at(-1)).toEqual(["ASELS"]));
    });

    it("sunucudaki favoriler açılışta Favoriler bölümünde görünür", async () => {
      setupFav(["GARAN", "SISE"]);
      await vi.waitFor(() => expect(screen.getByLabelText("Favoriler")).toHaveTextContent(/GARAN.*SISE/));
    });

    it("favori hisseler listenin en üstüne taşınır; diğerleri eski sırasını korur", async () => {
      setupFav(["GARAN"]);
      await screen.findByLabelText("Favoriler");
      await vi.waitFor(() => {
        const names = screen.getAllByRole("button", { name: /^[A-Z]+$/ }).map((b) => b.textContent);
        expect(names.slice(0, 3)).toEqual(["GARAN", "THYAO", "ASELS"]);
      });
    });

    it("birden çok favori listedeki sırasıyla en üstte durur", async () => {
      setupFav(["GARAN", "THYAO"]);
      await vi.waitFor(() => {
        const names = screen.getAllByRole("button", { name: /^[A-Z]+$/ }).map((b) => b.textContent);
        expect(names.slice(0, 3)).toEqual(["THYAO", "GARAN", "ASELS"]);
      });
    });

    it("yıldızdan çıkarılan hisse yerine, listedeki eski sırasına döner", async () => {
      setupFav(["GARAN"]);
      const box = await screen.findByLabelText("Favoriler");
      await userEvent.click(box.querySelector("button.star")!);
      await vi.waitFor(() => {
        const names = screen.getAllByRole("button", { name: /^[A-Z]+$/ }).map((b) => b.textContent);
        expect(names).toEqual(["THYAO", "ASELS", "GARAN"]);
      });
    });

    it("favori sıralaması arama süzmesiyle birlikte çalışır", async () => {
      setupFav(["GARAN"]);
      await screen.findByLabelText("Favoriler");
      await userEvent.type(screen.getByLabelText("Hisse ara"), "a");
      await vi.waitFor(() => {
        const names = screen.getAllByRole("button", { name: /^[A-Z]+$/ }).map((b) => b.textContent);
        expect(names.slice(0, 3)).toEqual(["GARAN", "THYAO", "ASELS"]);
      });
    });

    it("Favoriler bölümünden de hisse seçilebilir", async () => {
      setupFav(["SISE"]);
      const box = await screen.findByLabelText("Favoriler");
      await userEvent.click(box.querySelector("button.symbol")!);
      expect(screen.getByTestId("probe")).toHaveTextContent("SISE");
    });

    it("yıldızdan çıkarınca Favoriler bölümü boşalır", async () => {
      setupFav(["GARAN"]);
      const box = await screen.findByLabelText("Favoriler");
      await userEvent.click(box.querySelector("button.star")!);
      expect(await screen.findByText("Henüz favori yok.")).toBeInTheDocument();
    });

    it("Yahoo arama sonucundaki hisse de favoriye eklenebilir", async () => {
      localStorage.setItem(TOKEN_KEY, "tok");
      const { favPuts } = apiMock({ favorites: [] });
      render(
        <SelectionProvider>
          <FavoritesProvider>
            <Sidebar lists={LISTS} search={async () => [{ symbol: "TKFEN", name: "TEKFEN" }]} debounceMs={0} />
          </FavoritesProvider>
        </SelectionProvider>,
      );
      await userEvent.type(screen.getByLabelText("Hisse ara"), "tek");
      await userEvent.click(await screen.findByRole("button", { name: "TKFEN favoriye ekle" }));
      await vi.waitFor(() => expect(favPuts.at(-1)).toEqual(["TKFEN"]));
    });
  });

  describe("fiyat ve değişim", () => {
    it("her satırda fiyat ve yüzde değişimi gösterir (yeşil/kırmızı)", async () => {
      localStorage.setItem(TOKEN_KEY, "tok");
      apiMock({ quotes: { THYAO: { price: 110, prevClose: 100 }, ASELS: { price: 90, prevClose: 100 } } });
      setup();
      const up = await screen.findByTestId("q-THYAO");
      expect(up).toHaveTextContent("110,00");
      expect(up).toHaveTextContent("+10,00%");
      expect(up.querySelector(".price-chg")).toHaveClass("up");
      const down = screen.getByTestId("q-ASELS");
      expect(down).toHaveTextContent("90,00");
      expect(down).toHaveTextContent("-10,00%");
      expect(down.querySelector(".price-chg")).toHaveClass("down");
    });

    it("verisi gelmeyen hisse tire gösterir", async () => {
      localStorage.setItem(TOKEN_KEY, "tok");
      apiMock({ quotes: { THYAO: { price: 110, prevClose: 100 } } });
      setup();
      await screen.findByTestId("q-THYAO");
      expect(screen.getByTestId("q-GARAN")).toHaveTextContent("–");
    });

    it("fiyat satırı hisse butonunun adını bozmaz; fiyata tıklayınca da seçer", async () => {
      localStorage.setItem(TOKEN_KEY, "tok");
      apiMock({ quotes: { ASELS: { price: 90, prevClose: 100 } } });
      setup();
      const q = await screen.findByTestId("q-ASELS");
      expect(screen.getByRole("button", { name: "ASELS" })).toBeInTheDocument();
      await userEvent.click(q);
      expect(screen.getByTestId("probe")).toHaveTextContent("ASELS");
    });
  });
});
