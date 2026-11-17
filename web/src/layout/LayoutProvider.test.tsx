import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayout } from "./LayoutProvider";
import { renderWithApp } from "../test/render";
import { apiMock, TOKEN_KEY } from "../test/helpers";
import type { ModuleDef } from "../modules/types";

const mk = (id: string): ModuleDef => ({
  id,
  title: id,
  scope: "global",
  defaultSize: { w: 10, h: 6 },
  component: () => null,
});
const A = mk("a");
const B = mk("b");

function Probe() {
  const l = useLayout();
  return (
    <div>
      <span data-testid="status">{l.status}</span>
      <span data-testid="save">{l.saveState}</span>
      <span data-testid="items">{JSON.stringify(l.page.items)}</span>
      <button onClick={() => l.toggle(A)}>toggle a</button>
      <button onClick={() => l.toggle(B)}>toggle b</button>
      <button onClick={() => l.commitRect("a", { x: 5, y: 6, w: 7, h: 8 })}>move a</button>
      <button onClick={() => l.close("a")}>close a</button>
      <button onClick={l.reload}>reload</button>
      <span data-testid="tabs">{JSON.stringify(l.layout.tabs.map((t) => t.name))}</span>
      <span data-testid="active">{l.page.name}</span>
      <button onClick={l.addTab}>add tab</button>
      <button onClick={() => l.selectTab(l.layout.tabs[0].id)}>select first</button>
      <button onClick={() => l.renameTab(l.page.id, "Piyasa")}>rename</button>
      <button onClick={() => l.removeTab(l.page.id)}>remove active</button>
      <button onClick={() => l.moveTab(l.layout.tabs[0].id, l.layout.tabs[1].id)}>swap</button>
    </div>
  );
}

const status = () => screen.getByTestId("status").textContent;
const items = () => JSON.parse(screen.getByTestId("items").textContent!);
const ready = () => waitFor(() => expect(status()).toBe("ready"));

describe("yükleme", () => {
  it("sunucudaki düzeni yükler", async () => {
    apiMock({
      layout: { version: 1, items: [{ id: "a", x: 3, y: 4, w: 5, h: 6 }], parked: {} },
    });
    renderWithApp(<Probe />);
    expect(status()).toBe("loading");
    await ready();
    expect(items()).toEqual([{ id: "a", x: 3, y: 4, w: 5, h: 6 }]);
  });

  it("kayıt yoksa boş düzenle açılır", async () => {
    apiMock({ layout: null });
    renderWithApp(<Probe />);
    await ready();
    expect(items()).toEqual([]);
  });

  it("bozuk kayıtlı veriyi temizleyerek açar", async () => {
    apiMock({
      layout: {
        version: 1,
        items: [
          { id: "a", x: 1, y: 1, w: 2, h: 2 },
          { id: "KÖTÜ", x: 1, y: 1, w: 2, h: 2 },
        ],
      },
    });
    renderWithApp(<Probe />);
    await ready();
    expect(items()).toHaveLength(1);
  });

  it("yükleme hatasında 'error' olur, hiçbir şey kaydedilmez, tekrar denenebilir", async () => {
    const m = apiMock({ layoutGetStatus: 500 });
    renderWithApp(<Probe />);
    await waitFor(() => expect(status()).toBe("error"));
    await new Promise((r) => setTimeout(r, 60));
    expect(m.puts).toHaveLength(0);

    m.fn.mockClear();
    apiMock({ layout: { version: 1, items: [{ id: "a", x: 0, y: 0, w: 1, h: 1 }], parked: {} } });
    await userEvent.click(screen.getByText("reload"));
    await ready();
    expect(items()).toHaveLength(1);
  });

  it("401 gelirse oturum kapanır", async () => {
    apiMock({ layoutGetStatus: 401 });
    renderWithApp(<Probe />);
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBeNull());
  });
});

describe("kaydetme", () => {
  it("modül açılınca varsayılan boyutla yerleşir ve kaydedilir", async () => {
    const m = apiMock();
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("toggle a"));
    expect(items()).toEqual([{ id: "a", x: 0, y: 0, w: 10, h: 6 }]);
    await waitFor(() => expect(m.puts).toHaveLength(1));
    expect(m.puts[0].tabs[0].items).toEqual([{ id: "a", x: 0, y: 0, w: 10, h: 6 }]);
    await waitFor(() => expect(screen.getByTestId("save").textContent).toBe("idle"));
  });

  it("art arda değişiklikler tek istekte birleşir", async () => {
    const m = apiMock();
    renderWithApp(<Probe />, { saveDelayMs: 50 });
    await ready();
    await userEvent.click(screen.getByText("toggle a"));
    await userEvent.click(screen.getByText("toggle b"));
    await waitFor(() => expect(m.puts).toHaveLength(1));
    expect(m.puts[0].tabs[0].items.map((i: { id: string }) => i.id)).toEqual(["a", "b"]);
    await new Promise((r) => setTimeout(r, 120));
    expect(m.puts).toHaveLength(1);
  });

  it("taşıma yalnız ilgili modülü günceller", async () => {
    const m = apiMock({
      layout: {
        version: 1,
        items: [
          { id: "a", x: 0, y: 0, w: 10, h: 6 },
          { id: "b", x: 500, y: 0, w: 10, h: 6 },
        ],
        parked: {},
      },
    });
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("move a"));
    await waitFor(() => expect(m.puts).toHaveLength(1));
    expect(m.puts[0].tabs[0].items).toEqual([
      { id: "a", x: 5, y: 6, w: 7, h: 8 },
      { id: "b", x: 500, y: 0, w: 10, h: 6 },
    ]);
  });

  it("kapatılan modülün yeri parked'a yazılır, açılınca geri gelir", async () => {
    const m = apiMock({
      layout: { version: 1, items: [{ id: "a", x: 9, y: 9, w: 12, h: 7 }], parked: {} },
    });
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("close a"));
    await waitFor(() => expect(m.puts).toHaveLength(1));
    expect(m.puts[0].tabs[0].items).toEqual([]);
    expect(m.puts[0].tabs[0].parked).toEqual({ a: { x: 9, y: 9, w: 12, h: 7 } });

    await userEvent.click(screen.getByText("toggle a"));
    expect(items()).toEqual([{ id: "a", x: 9, y: 9, w: 12, h: 7 }]);
  });

  it("değişiklik yoksa istek atılmaz", async () => {
    const m = apiMock({
      layout: { version: 1, items: [{ id: "a", x: 5, y: 6, w: 7, h: 8 }], parked: {} },
    });
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("move a"));
    await new Promise((r) => setTimeout(r, 60));
    expect(m.puts).toHaveLength(0);
  });

  it("kayıt başarısız olursa 'error' olur ve kendiliğinden yeniden dener", async () => {
    const m = apiMock({ putStatuses: [500] });
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("toggle a"));
    await waitFor(() => expect(screen.getByTestId("save").textContent).toBe("error"));
    await waitFor(() => expect(m.puts).toHaveLength(2));
    expect(m.puts[1]).toEqual(m.puts[0]);
    await waitFor(() => expect(screen.getByTestId("save").textContent).toBe("idle"));
  });

  it("kayıt sürerken gelen değişiklik sıralı ve son haliyle kaydedilir", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const bodies: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const json = (b: unknown) =>
          new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.endsWith("/api/me")) return json({ ok: true });
        if (init?.method === "PUT") {
          bodies.push(JSON.parse(String(init.body)));
          if (bodies.length === 1) await gate;
          return json({ ok: true });
        }
        return json({ layout: null });
      }),
    );
    renderWithApp(<Probe />, { saveDelayMs: 10 });
    await ready();
    await userEvent.click(screen.getByText("toggle a"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    await userEvent.click(screen.getByText("toggle b"));
    await new Promise((r) => setTimeout(r, 60));
    expect(bodies).toHaveLength(1);
    release();
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].tabs[0].items.map((i: { id: string }) => i.id)).toEqual(["a", "b"]);
  });
});

describe("sekmeler", () => {
  const tabs = () => JSON.parse(screen.getByTestId("tabs").textContent!);
  const active = () => screen.getByTestId("active").textContent;

  it("eski tek sayfalı kayıt 'Sayfa 1' olarak açılır", async () => {
    apiMock({ layout: { version: 1, items: [{ id: "a", x: 0, y: 0, w: 1, h: 1 }], parked: {} } });
    renderWithApp(<Probe />);
    await ready();
    expect(tabs()).toEqual(["Sayfa 1"]);
    expect(items()).toHaveLength(1);
  });

  it("yeni sekme boş açılır; modül eklemeler yalnız etkin sekmeye gider; hepsi kaydedilir", async () => {
    const m = apiMock();
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("toggle a"));
    await userEvent.click(screen.getByText("add tab"));
    expect(tabs()).toEqual(["Sayfa 1", "Sayfa 2"]);
    expect(active()).toBe("Sayfa 2");
    expect(items()).toEqual([]);
    await userEvent.click(screen.getByText("toggle a")); // aynı modül ikinci sekmede de olabilir
    await userEvent.click(screen.getByText("select first"));
    expect(items().map((i: { id: string }) => i.id)).toEqual(["a"]);
    const last = () => m.puts[m.puts.length - 1];
    await waitFor(() => expect(last()?.tabs[1].items.map((i: { id: string }) => i.id)).toEqual(["a"]));
    await waitFor(() => expect(last().active).toBe(last().tabs[0].id));
    expect(last().version).toBe(2);
    expect(last().tabs.map((t: { name: string }) => t.name)).toEqual(["Sayfa 1", "Sayfa 2"]);
  });

  it("yeniden adlandırma, taşıma ve silme kaydedilir", async () => {
    const m = apiMock();
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("add tab"));
    await userEvent.click(screen.getByText("rename"));
    expect(tabs()).toEqual(["Sayfa 1", "Piyasa"]);
    await userEvent.click(screen.getByText("swap"));
    expect(tabs()).toEqual(["Piyasa", "Sayfa 1"]);
    await userEvent.click(screen.getByText("remove active")); // etkin: Piyasa
    expect(tabs()).toEqual(["Sayfa 1"]);
    await waitFor(() =>
      expect(m.puts[m.puts.length - 1]?.tabs.map((t: { name: string }) => t.name)).toEqual(["Sayfa 1"]),
    );
  });

  it("son sekme silinemez", async () => {
    apiMock();
    renderWithApp(<Probe />);
    await ready();
    await userEvent.click(screen.getByText("remove active"));
    expect(tabs()).toEqual(["Sayfa 1"]);
  });

  it("yükleme başarısızken sekme değişikliği yapılmaz", async () => {
    const m = apiMock({ layoutGetStatus: 500 });
    renderWithApp(<Probe />);
    await waitFor(() => expect(status()).toBe("error"));
    await userEvent.click(screen.getByText("add tab"));
    await new Promise((r) => setTimeout(r, 60));
    expect(m.puts).toHaveLength(0);
  });
});
