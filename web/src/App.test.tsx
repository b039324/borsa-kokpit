import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { apiMock, mockFetch, TOKEN_KEY } from "./test/helpers";

describe("oturum kontrolü", () => {
  it("token yoksa giriş ekranı açılır, istek atılmaz", () => {
    const f = mockFetch(() => ({ status: 200 }));
    render(<App />);
    expect(screen.getByLabelText("Şifre")).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });

  it("geçerli token ile ana ekran açılır ve Bearer başlığı gider", async () => {
    localStorage.setItem(TOKEN_KEY, "tok123");
    const f = mockFetch(() => ({ status: 200, body: { ok: true } }));
    render(<App />);
    expect(await screen.findByText("Borsa Kokpit")).toBeInTheDocument();
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/api/me");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("token geçersizse (401) giriş ekranına döner ve token silinir", async () => {
    localStorage.setItem(TOKEN_KEY, "eski");
    mockFetch(() => ({ status: 401, body: { error: "Giriş gerekli" } }));
    render(<App />);
    expect(await screen.findByLabelText("Şifre")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("sunucuya ulaşılamazsa token silinmez, tekrar dene ile düzelir", async () => {
    localStorage.setItem(TOKEN_KEY, "tok123");
    let fail = true;
    mockFetch(() => (fail ? new TypeError("ağ yok") : { status: 200, body: { ok: true } }));
    render(<App />);
    expect(await screen.findByText(/Sunucuya ulaşılamadı/)).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok123");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByText("Borsa Kokpit")).toBeInTheDocument();
  });

  it("sunucu 500 dönerse de token silinmez", async () => {
    localStorage.setItem(TOKEN_KEY, "tok123");
    mockFetch(() => ({ status: 500 }));
    render(<App />);
    expect(await screen.findByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok123");
  });
});

describe("giriş", () => {
  it("doğru şifre: token saklanır, ana ekran açılır", async () => {
    const f = mockFetch((url) =>
      url.endsWith("/api/login")
        ? { status: 200, body: { token: "yeni-token", expiresIn: 100 } }
        : { status: 404 },
    );
    render(<App />);
    await userEvent.type(screen.getByLabelText("Şifre"), "dogru");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(await screen.findByText("Borsa Kokpit")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("yeni-token");
    const body = JSON.parse(String(f.mock.calls[0][1]?.body));
    expect(body).toEqual({ password: "dogru" });
  });

  it("yanlış şifre: hata gösterilir, token saklanmaz", async () => {
    mockFetch(() => ({ status: 401, body: { error: "Şifre hatalı" } }));
    render(<App />);
    await userEvent.type(screen.getByLabelText("Şifre"), "yanlis");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Şifre hatalı");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("kilitlenme (429) sunucu mesajını gösterir", async () => {
    mockFetch(() => ({ status: 429, body: { error: "Çok fazla hatalı deneme." } }));
    render(<App />);
    await userEvent.type(screen.getByLabelText("Şifre"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla hatalı deneme.");
  });

  it("boş şifre: istek atılmaz, uyarı çıkar", async () => {
    const f = mockFetch(() => ({ status: 200 }));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Şifreyi gir");
    expect(f).not.toHaveBeenCalled();
  });

  it("ağ hatası: anlaşılır mesaj gösterilir", async () => {
    mockFetch(() => new TypeError("ağ yok"));
    render(<App />);
    await userEvent.type(screen.getByLabelText("Şifre"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sunucuya ulaşılamadı");
  });

  it("hata sonrası tekrar denenebilir", async () => {
    let n = 0;
    mockFetch(() =>
      n++ === 0
        ? { status: 401, body: { error: "Şifre hatalı" } }
        : { status: 200, body: { token: "t", expiresIn: 1 } },
    );
    render(<App />);
    const input = screen.getByLabelText("Şifre");
    await userEvent.type(input, "yanlis");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    await screen.findByRole("alert");
    await userEvent.clear(input);
    await userEvent.type(input, "dogru");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    await waitFor(() => expect(screen.getByText("Borsa Kokpit")).toBeInTheDocument());
  });
});

describe("çıkış", () => {
  it("Çıkış token'ı siler ve giriş ekranına döner", async () => {
    localStorage.setItem(TOKEN_KEY, "tok123");
    mockFetch(() => ({ status: 200, body: { ok: true } }));
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Çıkış" }));
    expect(screen.getByLabelText("Şifre")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("varsayılan hisse", () => {
  it("açılışta hisse seçmeden AKBNK seçili gelir ve grafiği istenir", async () => {
    localStorage.setItem(TOKEN_KEY, "tok123");
    const { fn } = apiMock({
      layout: { version: 2, active: "a", tabs: [{ id: "a", name: "Hisse", items: [{ id: "grafik", x: 0, y: 0, w: 36, h: 20 }], parked: [] }] },
    });
    render(<App />);
    await screen.findByText("Borsa Kokpit");
    await waitFor(() => expect(fn.mock.calls.some((c) => /[?&]symbol=AKBNK/.test(String(c[0])))).toBe(true));
    expect(screen.queryByText("Bir hisse seç.")).toBeNull();
  });
});
