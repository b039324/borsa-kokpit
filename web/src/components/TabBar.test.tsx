import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "./TabBar";
import { renderWithApp } from "../test/render";
import { apiMock } from "../test/helpers";

const tab = (id: string, name: string, n = 0) => ({
  id,
  name,
  items: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, x: i * 6, y: 0, w: 5, h: 5 })),
  parked: {},
});
const layout = (tabs: ReturnType<typeof tab>[], active = tabs[0].id) => ({ version: 2, active, tabs });

const lastPut = (m: ReturnType<typeof apiMock>) => m.puts[m.puts.length - 1];
const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent?.replace("×", "").trim());

async function setup(l: unknown) {
  const m = apiMock({ layout: l });
  renderWithApp(<TabBar />);
  await screen.findAllByRole("tab");
  return m;
}

afterEach(() => vi.restoreAllMocks());

describe("TabBar", () => {
  it("sekmeleri sırayla gösterir; etkin olan seçili işaretlenir", async () => {
    await setup(layout([tab("a", "Hisse"), tab("b", "Piyasa")], "b"));
    expect(tabNames()).toEqual(["Hisse", "Piyasa"]);
    expect(screen.getByRole("tab", { name: /Piyasa/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Hisse/ })).toHaveAttribute("aria-selected", "false");
  });

  it("tıklayınca sekme değişir ve kaydedilir", async () => {
    const m = await setup(layout([tab("a", "Hisse"), tab("b", "Piyasa")]));
    await userEvent.click(screen.getByRole("tab", { name: /Piyasa/ }));
    expect(screen.getByRole("tab", { name: /Piyasa/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(lastPut(m)?.active).toBe("b"));
  });

  it("'+' boş yeni sayfa açar ve etkin yapar", async () => {
    const m = await setup(layout([tab("a", "Hisse", 2)]));
    await userEvent.click(screen.getByRole("button", { name: "Yeni sayfa" }));
    expect(tabNames()).toEqual(["Hisse", "Sayfa 1"]);
    expect(screen.getByRole("tab", { name: /Sayfa 1/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(lastPut(m)?.tabs[1].items).toEqual([]));
  });

  it("8 sekmede '+' pasif olur", async () => {
    const tabs = Array.from({ length: 8 }, (_, i) => tab(`t${i}`, `S${i}`));
    await setup(layout(tabs));
    expect(screen.getByRole("button", { name: "Yeni sayfa" })).toBeDisabled();
  });

  it("boş sekme onaysız silinir", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const m = await setup(layout([tab("a", "Hisse"), tab("b", "Boş")]));
    await userEvent.click(screen.getByRole("button", { name: "Boş sayfasını sil" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(tabNames()).toEqual(["Hisse"]);
    await waitFor(() => expect(lastPut(m)?.tabs).toHaveLength(1));
  });

  it("modüllü sekme silinmeden önce onay ister; vazgeçilirse silinmez", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await setup(layout([tab("a", "Hisse", 3), tab("b", "Piyasa")]));
    await userEvent.click(screen.getByRole("button", { name: "Hisse sayfasını sil" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(tabNames()).toEqual(["Hisse", "Piyasa"]);
    await userEvent.click(screen.getByRole("button", { name: "Hisse sayfasını sil" }));
    expect(tabNames()).toEqual(["Piyasa"]);
  });

  it("tek sekme kaldığında silme düğmesi görünmez", async () => {
    await setup(layout([tab("a", "Hisse")]));
    expect(screen.queryByRole("button", { name: /sayfasını sil/ })).toBeNull();
  });

  it("çift tıklayınca ad düzenlenir; Enter kaydeder", async () => {
    const m = await setup(layout([tab("a", "Hisse"), tab("b", "Piyasa")]));
    await userEvent.dblClick(screen.getByRole("tab", { name: /Hisse/ }));
    const input = screen.getByRole("textbox", { name: "Sayfa adı" });
    expect(input).toHaveValue("Hisse");
    await userEvent.clear(input);
    await userEvent.type(input, "Benim sayfam{Enter}");
    expect(tabNames()).toEqual(["Benim sayfam", "Piyasa"]);
    await waitFor(() => expect(lastPut(m)?.tabs[0].name).toBe("Benim sayfam"));
  });

  it("Escape adı değiştirmeden çıkar; boş ad kabul edilmez", async () => {
    await setup(layout([tab("a", "Hisse")]));
    await userEvent.dblClick(screen.getByRole("tab", { name: /Hisse/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Sayfa adı" }), "xyz{Escape}");
    expect(tabNames()).toEqual(["Hisse"]);

    await userEvent.dblClick(screen.getByRole("tab", { name: /Hisse/ }));
    const input = screen.getByRole("textbox", { name: "Sayfa adı" });
    await userEvent.clear(input);
    await userEvent.type(input, "{Enter}");
    expect(tabNames()).toEqual(["Hisse"]);
  });

  it("odaktan çıkınca ad kaydedilir", async () => {
    await setup(layout([tab("a", "Hisse")]));
    await userEvent.dblClick(screen.getByRole("tab", { name: /Hisse/ }));
    const input = screen.getByRole("textbox", { name: "Sayfa adı" });
    await userEvent.clear(input);
    await userEvent.type(input, "Yeni");
    fireEvent.blur(input);
    expect(tabNames()).toEqual(["Yeni"]);
  });

  it("sürükle-bırak ile sıra değişir ve kaydedilir", async () => {
    const m = await setup(layout([tab("a", "A"), tab("b", "B"), tab("c", "C")]));
    const dt = { setData: vi.fn(), getData: vi.fn(() => "a"), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(screen.getByRole("tab", { name: /^A/ }), { dataTransfer: dt });
    fireEvent.dragOver(screen.getByRole("tab", { name: /^C/ }), { dataTransfer: dt });
    fireEvent.drop(screen.getByRole("tab", { name: /^C/ }), { dataTransfer: dt });
    expect(tabNames()).toEqual(["B", "C", "A"]);
    await waitFor(() => expect(lastPut(m)?.tabs.map((t: { id: string }) => t.id)).toEqual(["b", "c", "a"]));
  });

  it("düzenlenirken sekme sürüklenemez", async () => {
    await setup(layout([tab("a", "A"), tab("b", "B")]));
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("draggable", "true");
    await userEvent.dblClick(screen.getAllByRole("tab")[0]);
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("draggable", "false");
  });
});
