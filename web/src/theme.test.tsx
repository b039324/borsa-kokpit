import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme, THEME_KEY } from "./theme";

function Probe() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} data-testid="t">
      {theme}
    </button>
  );
}
const mount = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

function stubPrefersLight(light: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: light && q.includes("light"), media: q, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => vi.unstubAllGlobals());

describe("tema", () => {
  it("kayıt yoksa ve tercih belirtilmemişse koyu açılır", () => {
    mount();
    expect(screen.getByTestId("t")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("kayıt yoksa sistem açık temayı tercih ediyorsa açık açılır", () => {
    stubPrefersLight(true);
    mount();
    expect(screen.getByTestId("t")).toHaveTextContent("light");
  });

  it("kayıtlı seçim sistem tercihinden önce gelir", () => {
    stubPrefersLight(true);
    localStorage.setItem(THEME_KEY, "dark");
    mount();
    expect(screen.getByTestId("t")).toHaveTextContent("dark");
  });

  it("geçersiz kayıt yok sayılır", () => {
    localStorage.setItem(THEME_KEY, "mor");
    mount();
    expect(screen.getByTestId("t")).toHaveTextContent("dark");
  });

  it("değiştirince sayfaya uygulanır ve kaydedilir; ikinci tıkla geri döner", async () => {
    mount();
    await userEvent.click(screen.getByTestId("t"));
    expect(screen.getByTestId("t")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    await userEvent.click(screen.getByTestId("t"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("depolama kapalıysa bile çalışır", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("kota");
    });
    mount();
    await userEvent.click(screen.getByTestId("t"));
    expect(screen.getByTestId("t")).toHaveTextContent("light");
    vi.restoreAllMocks();
  });

  it("sağlayıcı yoksa varsayılan bağlam çökmez", () => {
    render(<Probe />);
    expect(screen.getByTestId("t")).toHaveTextContent("dark");
  });
});
