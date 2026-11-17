import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModuleDrawer } from "./ModuleDrawer";
import { Canvas } from "./Canvas";
import { createRegistry } from "../modules/registry";
import type { ModuleDef } from "../modules/types";
import { renderWithApp } from "../test/render";
import { apiMock } from "../test/helpers";

const defs: ModuleDef[] = [
  {
    id: "a",
    title: "Modül A",
    scope: "global",
    defaultSize: { w: 10, h: 6 },
    component: () => <div>A-içerik</div>,
  },
  {
    id: "b",
    title: "Modül B",
    scope: "stock",
    defaultSize: { w: 10, h: 6 },
    component: () => <div>B-içerik</div>,
  },
];
const registry = createRegistry(defs);

function setup(onClose = () => {}) {
  return renderWithApp(
    <>
      <ModuleDrawer registry={registry} onClose={onClose} />
      <Canvas registry={registry} />
    </>,
  );
}

describe("ModuleDrawer", () => {
  it("yüklenirken anahtarları göstermez", () => {
    apiMock();
    setup();
    expect(screen.getByText("Modüller yükleniyor…")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("tüm kayıtlı modülleri kapsamlarıyla listeler", async () => {
    apiMock();
    setup();
    expect(await screen.findByRole("switch", { name: "Modül A" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Modül B" })).toBeInTheDocument();
    expect(screen.getByText("bağımsız")).toBeInTheDocument();
    expect(screen.getByText("hisseye bağlı")).toBeInTheDocument();
  });

  it("anahtarlar kayıtlı düzeni yansıtır ve sayaç doğrudur", async () => {
    apiMock({
      layout: { version: 1, items: [{ id: "a", x: 0, y: 0, w: 5, h: 5 }], parked: {} },
    });
    setup();
    expect(await screen.findByRole("switch", { name: "Modül A" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Modül B" })).not.toBeChecked();
    expect(screen.getByText("1/2 modül açık")).toBeInTheDocument();
  });

  it("anahtarı açınca modül sayfada belirir ve düzen kaydedilir", async () => {
    const m = apiMock();
    setup();
    await userEvent.click(await screen.findByRole("switch", { name: "Modül A" }));
    expect(screen.getByRole("switch", { name: "Modül A" })).toBeChecked();
    expect(await screen.findByText("A-içerik")).toBeInTheDocument();
    await waitFor(() => expect(m.puts).toHaveLength(1));
    expect(m.puts[0].tabs[0].items).toEqual([{ id: "a", x: 0, y: 0, w: 10, h: 6 }]);
  });

  it("anahtarı kapatınca modül kalkar", async () => {
    apiMock({
      layout: { version: 1, items: [{ id: "a", x: 0, y: 0, w: 5, h: 5 }], parked: {} },
    });
    setup();
    expect(await screen.findByText("A-içerik")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Modül A" }));
    expect(screen.queryByText("A-içerik")).toBeNull();
  });

  it("kapat düğmesi ve Esc onClose çağırır", async () => {
    apiMock();
    const onClose = vi.fn();
    setup(onClose);
    await userEvent.click(screen.getByRole("button", { name: "Kapat" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
