import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Canvas } from "./Canvas";
import { TabBar } from "./TabBar";
import { createRegistry } from "../modules/registry";
import type { ModuleDef, ModuleProps } from "../modules/types";
import { useSelection } from "../selection";
import { renderWithApp } from "../test/render";
import { apiMock } from "../test/helpers";

const defs: ModuleDef[] = [
  {
    id: "a",
    title: "Modül A",
    scope: "global",
    defaultSize: { w: 10, h: 6 },
    minSize: { w: 4, h: 4 },
    component: () => <div>A-içerik</div>,
  },
  {
    id: "b",
    title: "Modül B",
    scope: "stock",
    defaultSize: { w: 10, h: 6 },
    minSize: { w: 4, h: 4 },
    component: ({ symbol }: ModuleProps) => <div>B:{symbol}</div>,
  },
];
const registry = createRegistry(defs);

function Selector() {
  const { select } = useSelection();
  return <button onClick={() => select("THYAO")}>THYAO seç</button>;
}

function setup() {
  return renderWithApp(
    <>
      <Selector />
      <Canvas registry={registry} />
    </>,
  );
}

const SAVED = {
  version: 1,
  items: [
    { id: "a", x: 2, y: 3, w: 5, h: 4 },
    { id: "b", x: 20, y: 0, w: 10, h: 6 },
  ],
  parked: {},
};

describe("Canvas", () => {
  it("yüklenirken bilgi gösterir", () => {
    apiMock({ layout: SAVED });
    setup();
    expect(screen.getByText("Düzen yükleniyor…")).toBeInTheDocument();
  });

  it("modül yoksa boş durum mesajını gösterir", async () => {
    apiMock({ layout: null });
    setup();
    expect(await screen.findByText("Henüz modül eklenmedi.")).toBeInTheDocument();
  });

  it("kayıtlı modülleri çerçevesiyle çizer", async () => {
    apiMock({ layout: SAVED });
    setup();
    expect(await screen.findByText("A-içerik")).toBeInTheDocument();
    expect(screen.getByLabelText("Modül A")).toBeInTheDocument();
    expect(screen.getByLabelText("Modül B")).toBeInTheDocument();
    expect(screen.queryByText("Henüz modül eklenmedi.")).toBeNull();
  });

  it("konum ve boyut ızgara hücresi (20px) ile piksele çevrilir", async () => {
    apiMock({ layout: SAVED });
    setup();
    const item = (await screen.findByLabelText("Modül A")).closest(".react-grid-item") as HTMLElement;
    expect(item.style.width).toBe("100px");
    expect(item.style.height).toBe("80px");
    expect(item.style.transform.replace(/\s/g, "")).toBe("translate(40px,60px)");
  });

  it("hisseye bağlı modül seçim yokken yönlendirir, seçilince içeriği gösterir", async () => {
    apiMock({ layout: SAVED });
    setup();
    expect(await screen.findByText("Bir hisse seç.")).toBeInTheDocument();
    await userEvent.click(screen.getByText("THYAO seç"));
    expect(screen.getByText("B:THYAO")).toBeInTheDocument();
    expect(screen.queryByText("Bir hisse seç.")).toBeNull();
  });

  it("kayıtlı ama koddan silinmiş modülü atlar, çökmez", async () => {
    apiMock({
      layout: {
        version: 1,
        items: [
          { id: "a", x: 0, y: 0, w: 5, h: 5 },
          { id: "silinmis-modul", x: 10, y: 0, w: 5, h: 5 },
        ],
        parked: {},
      },
    });
    setup();
    expect(await screen.findByText("A-içerik")).toBeInTheDocument();
    expect(screen.queryByLabelText("silinmis-modul")).toBeNull();
  });

  it("silinmiş modülün kaydı, başka değişiklikte sunucuda korunur", async () => {
    const m = apiMock({
      layout: {
        version: 1,
        items: [
          { id: "a", x: 0, y: 0, w: 5, h: 5 },
          { id: "silinmis-modul", x: 10, y: 0, w: 5, h: 5 },
        ],
        parked: {},
      },
    });
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Kapat: Modül A" }));
    await waitFor(() => expect(m.puts).toHaveLength(1));
    expect(m.puts[0].tabs[0].items.map((i: { id: string }) => i.id)).toEqual(["silinmis-modul"]);
    expect(Object.keys(m.puts[0].tabs[0].parked)).toEqual(["a"]);
  });

  it("çerçevedeki × modülü kapatır ve kaydeder", async () => {
    const m = apiMock({ layout: SAVED });
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Kapat: Modül A" }));
    expect(screen.queryByText("A-içerik")).toBeNull();
    await waitFor(() => expect(m.puts).toHaveLength(1));
  });

  it("düzen yüklenemezse hata ve Tekrar dene gösterir", async () => {
    const m = apiMock({ layoutGetStatus: 500 });
    setup();
    expect(await screen.findByText("Düzen yüklenemedi.")).toBeInTheDocument();
    expect(m.puts).toHaveLength(0);
    apiMock({ layout: SAVED });
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByText("A-içerik")).toBeInTheDocument();
  });
});

describe("Canvas + sekmeler", () => {
  it("her sekme kendi modüllerini gösterir; hisse modülü hisse seçilmediyse uyarı verir", async () => {
    apiMock({
      layout: {
        version: 2,
        active: "t1",
        tabs: [
          { id: "t1", name: "Bir", items: [{ id: "a", x: 0, y: 0, w: 10, h: 6 }], parked: {} },
          { id: "t2", name: "İki", items: [{ id: "b", x: 0, y: 0, w: 10, h: 6 }], parked: {} },
        ],
      },
    });
    renderWithApp(
      <>
        <TabBar />
        <Canvas registry={registry} />
      </>,
    );
    expect(await screen.findByText("A-içerik")).toBeInTheDocument();
    expect(screen.queryByText(/^B:/)).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: /İki/ }));
    expect(screen.queryByText("A-içerik")).toBeNull();
    expect(screen.getByText("Bir hisse seç.")).toBeInTheDocument();
  });
});
