import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def from "./pozisyon-hesaplayici.module";
import { apiMock, TOKEN_KEY } from "../test/helpers";

const Comp = def.component;

async function fill(label: string, value: string) {
  const el = screen.getByLabelText(label);
  await userEvent.clear(el);
  if (value) await userEvent.type(el, value);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, "tok");
});
afterEach(() => vi.unstubAllGlobals());

describe("pozisyon hesaplayıcı modülü", () => {
  it("tanım: hisseden bağımsız (hisse seçiliyse son fiyatı önerir)", () => {
    expect(def.id).toBe("pozisyon-hesaplayici");
    expect(def.scope).toBe("global");
  });

  it("adet, risk/ödül ve TL tutarlarını hesaplar", async () => {
    apiMock();
    render(<Comp symbol={null} />);
    await fill("Sermaye (TL)", "100000");
    await fill("Risk (%)", "1");
    await fill("Giriş", "100");
    await fill("Stop", "95");
    await fill("Hedef", "115");
    expect(screen.getByTestId("pz-yon")).toHaveTextContent("Alım");
    expect(screen.getByTestId("pz-shares")).toHaveTextContent("200");
    expect(screen.getByTestId("pz-rr")).toHaveTextContent("1 : 3,00");
    expect(screen.getByTestId("pz-loss")).toHaveTextContent("1.000,00");
    expect(screen.getByTestId("pz-gain")).toHaveTextContent("3.000,00");
    expect(screen.getByTestId("pz-value")).toHaveTextContent("20.000,00");
  });

  it("virgüllü sayı girişini kabul eder", async () => {
    apiMock();
    render(<Comp symbol={null} />);
    await fill("Sermaye (TL)", "50000");
    await fill("Risk (%)", "0,5");
    await fill("Giriş", "10,5");
    await fill("Stop", "10");
    expect(screen.getByTestId("pz-shares")).toHaveTextContent("500"); // 250 / 0,5
  });

  it("stop girişin üstündeyse açığa satış der", async () => {
    apiMock();
    render(<Comp symbol={null} />);
    await fill("Sermaye (TL)", "100000");
    await fill("Giriş", "100");
    await fill("Stop", "105");
    await fill("Hedef", "85");
    expect(screen.getByTestId("pz-yon")).toHaveTextContent("Açığa satış");
    expect(screen.getByTestId("pz-rr")).toHaveTextContent("1 : 3,00");
  });

  it("hedef yanlış yöndeyse uyarır", async () => {
    apiMock();
    render(<Comp symbol={null} />);
    await fill("Sermaye (TL)", "100000");
    await fill("Giriş", "100");
    await fill("Stop", "95");
    await fill("Hedef", "90");
    expect(screen.getByRole("alert")).toHaveTextContent(/hedef/i);
  });

  it("pozisyon sermayeyi aşarsa uyarır", async () => {
    apiMock();
    render(<Comp symbol={null} />);
    await fill("Sermaye (TL)", "100000");
    await fill("Giriş", "100");
    await fill("Stop", "99,5");
    expect(screen.getByRole("alert")).toHaveTextContent(/sermaye/i);
  });

  it("eksik girişte sonuç göstermez", async () => {
    apiMock();
    render(<Comp symbol={null} />);
    expect(screen.queryByTestId("pz-shares")).toBeNull();
    expect(screen.getByText(/Giriş ve stop/i)).toBeInTheDocument();
  });

  it("hisse seçiliyse 'Son fiyat' düğmesi girişi doldurur", async () => {
    apiMock({ quotes: { THYAO: { price: 312.5, prevClose: 300 } } });
    render(<Comp symbol="THYAO" />);
    await userEvent.click(await screen.findByRole("button", { name: /Son fiyat/ }));
    expect(screen.getByLabelText("Giriş")).toHaveValue("312,50");
  });

  it("sermaye ve risk yüzdesi bir sonraki açılışta hatırlanır", async () => {
    apiMock();
    const first = render(<Comp symbol={null} />);
    await fill("Sermaye (TL)", "250000");
    await fill("Risk (%)", "2");
    first.unmount();
    render(<Comp symbol={null} />);
    expect(screen.getByLabelText("Sermaye (TL)")).toHaveValue("250000");
    expect(screen.getByLabelText("Risk (%)")).toHaveValue("2");
  });

  it("bilgi notu: tavsiye değildir", () => {
    apiMock();
    render(<Comp symbol={null} />);
    expect(screen.getByText(/tavsiyesi değildir/i)).toBeInTheDocument();
  });
});
