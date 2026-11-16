import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import def from "./fiyat-alarmi.module";
import { AlarmsProvider } from "../alarms";
import { SelectionProvider, useSelection } from "../selection";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;
const Select = ({ sym }: { sym: string }) => {
  const { select } = useSelection();
  useEffect(() => select(sym), [sym, select]);
  return null;
};
const alarm = (over: any = {}) => ({ id: "a1", symbol: "THYAO", dir: "above", price: 350, createdAt: 1, triggeredAt: null, ...over });

function setup(opts: Parameters<typeof apiMock>[0], selected?: string) {
  const api = apiMock(opts);
  render(
    <SelectionProvider>
      <AlarmsProvider>
        {selected && <Select sym={selected} />}
        <Comp symbol={null} />
      </AlarmsProvider>
    </SelectionProvider>,
  );
  return api;
}

beforeEach(() => localStorage.setItem(TOKEN_KEY, "tok"));
afterEach(() => vi.unstubAllGlobals());

describe("fiyat alarmı modülü", () => {
  it("tanım: global", () => {
    expect(def.id).toBe("fiyat-alarmi");
    expect(def.scope).toBe("global");
  });

  it("alarmları hedef, yön ve güncel fiyatla listeler", async () => {
    setup({ alarms: [alarm()], quotes: { THYAO: { price: 340, prevClose: 330 } } });
    const row = await screen.findByTestId("alarm-a1");
    expect(row).toHaveTextContent("THYAO");
    expect(row).toHaveTextContent("Üstüne çıkınca");
    expect(row).toHaveTextContent("350,00");
    await waitFor(() => expect(row).toHaveTextContent("340,00"));
  });

  it("hedefe ulaşınca bildirim gösterir, alarmı tetiklenmiş işaretler ve kaydeder", async () => {
    const api = setup({ alarms: [alarm()], quotes: { THYAO: { price: 360, prevClose: 340 } } });
    const toast = await screen.findByTestId("alarm-toast");
    expect(toast).toHaveTextContent("THYAO");
    expect(toast).toHaveTextContent("350,00");
    expect(toast).toHaveTextContent("hedefine ulaştı");
    expect(await screen.findByText("Tetiklendi")).toBeInTheDocument();
    await waitFor(() => {
      const last = api.alarmPuts.at(-1)!;
      expect(typeof last[0].triggeredAt).toBe("number");
    });
  });

  it("bildirim kapatılabilir", async () => {
    setup({ alarms: [alarm()], quotes: { THYAO: { price: 360, prevClose: 340 } } });
    await screen.findByTestId("alarm-toast");
    await userEvent.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(screen.queryByTestId("alarm-toast")).not.toBeInTheDocument();
  });

  it("seçili hisse için hedef girince yönü güncel fiyata göre belirleyip kaydeder", async () => {
    const api = setup({ alarms: [], quotes: { THYAO: { price: 340, prevClose: 330 } } }, "THYAO");
    const input = await screen.findByLabelText("Hedef fiyat");
    await waitFor(() => expect(screen.getByRole("button", { name: "Alarm kur" })).toBeEnabled());
    await userEvent.type(input, "350,5");
    await userEvent.click(screen.getByRole("button", { name: "Alarm kur" }));
    await waitFor(() => expect(api.alarmPuts.length).toBeGreaterThan(0));
    expect(api.alarmPuts.at(-1)![0]).toMatchObject({ symbol: "THYAO", dir: "above", price: 350.5, triggeredAt: null });
    expect(await screen.findByTestId(/^alarm-/)).toHaveTextContent("Üstüne çıkınca");
  });

  it("hedef güncel fiyatın altındaysa 'altına inince' alarmı kurar", async () => {
    const api = setup({ alarms: [], quotes: { THYAO: { price: 340, prevClose: 330 } } }, "THYAO");
    const input = await screen.findByLabelText("Hedef fiyat");
    await waitFor(() => expect(screen.getByRole("button", { name: "Alarm kur" })).toBeEnabled());
    await userEvent.type(input, "320");
    await userEvent.click(screen.getByRole("button", { name: "Alarm kur" }));
    await waitFor(() => expect(api.alarmPuts.at(-1)![0].dir).toBe("below"));
  });

  it("hedef güncel fiyata eşitse reddeder", async () => {
    const api = setup({ alarms: [], quotes: { THYAO: { price: 340, prevClose: 330 } } }, "THYAO");
    const input = await screen.findByLabelText("Hedef fiyat");
    await waitFor(() => expect(screen.getByRole("button", { name: "Alarm kur" })).toBeEnabled());
    await userEvent.type(input, "340");
    await userEvent.click(screen.getByRole("button", { name: "Alarm kur" }));
    expect(await screen.findByText("Hedef güncel fiyattan farklı olmalı.")).toBeInTheDocument();
    expect(api.alarmPuts).toHaveLength(0);
  });

  it("geçersiz giriş reddedilir", async () => {
    setup({ alarms: [], quotes: { THYAO: { price: 340, prevClose: 330 } } }, "THYAO");
    const input = await screen.findByLabelText("Hedef fiyat");
    await waitFor(() => expect(screen.getByRole("button", { name: "Alarm kur" })).toBeEnabled());
    await userEvent.type(input, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Alarm kur" }));
    expect(await screen.findByText("Geçerli bir fiyat gir.")).toBeInTheDocument();
  });

  it("alarm silinir ve kaydedilir", async () => {
    const api = setup({ alarms: [alarm()], quotes: { THYAO: { price: 340, prevClose: 330 } } });
    await userEvent.click(await screen.findByRole("button", { name: "THYAO alarmını sil" }));
    await waitFor(() => expect(api.alarmPuts.at(-1)).toEqual([]));
    expect(screen.queryByTestId("alarm-a1")).not.toBeInTheDocument();
  });

  it("hisse seçili değilse yönlendirir", async () => {
    setup({ alarms: [] });
    expect(await screen.findByText("Alarm kurmak için soldan bir hisse seç.")).toBeInTheDocument();
  });

  it("alarm yoksa bilgi verir", async () => {
    setup({ alarms: [] });
    expect(await screen.findByText("Henüz alarm yok.")).toBeInTheDocument();
  });

  it("yükleme hatasında mesaj gösterir ve kaydetmez", async () => {
    const api = setup({ alarms: [], alarmsGetStatus: 500 }, "THYAO");
    expect(await screen.findByText("Alarmlar yüklenemedi.")).toBeInTheDocument();
    expect(api.alarmPuts).toHaveLength(0);
  });

  it("sayfa açıkken kontrol edildiğini belirtir", async () => {
    setup({ alarms: [] });
    expect(await screen.findByText(/sayfa açıkken/i)).toBeInTheDocument();
  });
});
