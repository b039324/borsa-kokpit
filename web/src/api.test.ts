import { describe, it, expect } from "vitest";
import { login, checkSession, ApiError, NetworkError } from "./api";
import { mockFetch } from "./test/helpers";

describe("api", () => {
  it("login başarılıysa token döner", async () => {
    mockFetch(() => ({ status: 200, body: { token: "t", expiresIn: 5 } }));
    expect(await login("x")).toEqual({ token: "t", expiresIn: 5 });
  });

  it("login hatasında sunucu mesajıyla ApiError fırlatır", async () => {
    mockFetch(() => ({ status: 401, body: { error: "Şifre hatalı" } }));
    await expect(login("x")).rejects.toMatchObject({ status: 401, message: "Şifre hatalı" });
    await expect(login("x")).rejects.toBeInstanceOf(ApiError);
  });

  it("gövdesi bozuk hata yanıtında varsayılan mesaj kullanılır", async () => {
    const f = mockFetch(() => ({ status: 502 }));
    f.mockImplementationOnce(async () => new Response("<html>", { status: 502 }));
    await expect(login("x")).rejects.toMatchObject({ status: 502, message: "Giriş yapılamadı" });
  });

  it("ağ hatası NetworkError olur", async () => {
    mockFetch(() => new TypeError("ağ yok"));
    await expect(login("x")).rejects.toBeInstanceOf(NetworkError);
    await expect(checkSession("t")).rejects.toBeInstanceOf(NetworkError);
  });

  it("checkSession: 200 true, 401 false, diğerleri hata", async () => {
    mockFetch(() => ({ status: 200 }));
    expect(await checkSession("t")).toBe(true);
    mockFetch(() => ({ status: 401 }));
    expect(await checkSession("t")).toBe(false);
    mockFetch(() => ({ status: 500 }));
    await expect(checkSession("t")).rejects.toBeInstanceOf(ApiError);
  });
});
