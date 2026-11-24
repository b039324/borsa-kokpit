import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "./TopBar";
import { ThemeProvider, THEME_KEY } from "../theme";
import { renderWithApp } from "../test/render";
import { apiMock } from "../test/helpers";

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  delete document.documentElement.dataset.theme;
});

function setup() {
  apiMock();
  renderWithApp(
    <ThemeProvider>
      <TopBar drawerOpen={false} onToggleDrawer={() => {}} />
    </ThemeProvider>,
  );
}

describe("TopBar tema düğmesi", () => {
  it("koyuyken 'Açık temaya geç' der, tıklayınca temayı değiştirir ve etiketi tersine çevirir", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Açık temaya geç" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Koyu temaya geç" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Koyu temaya geç" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("TopBar sistem testi", () => {
  it("'Sistem testi' düğmesi üst çubukta; tıklayınca pencere açılır", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Sistem testi" }));
    expect(screen.getByRole("dialog", { name: "Sistem testi" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("TopBar uygulama yükleme", () => {
  it("tarayıcı kurulum izni verince 'Uygulamayı yükle' düğmesi çıkar", async () => {
    setup();
    expect(screen.queryByRole("button", { name: "Uygulamayı yükle" })).not.toBeInTheDocument();
    const e = new Event("beforeinstallprompt", { cancelable: true }) as any;
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
    expect(await screen.findByRole("button", { name: "Uygulamayı yükle" })).toBeInTheDocument();
  });
});
