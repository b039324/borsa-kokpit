import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { makeEnv, req, loginReq } from "./helpers";

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("sağlık ucu", () => {
  it("GET /api/health giriş istemeden ok döner", async () => {
    const res = await worker.fetch(req("/api/health"), makeEnv());
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });
});

describe("giriş", () => {
  it("doğru şifre token döner", async () => {
    const res = await worker.fetch(loginReq("dogru-sifre"), makeEnv());
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.token).toBe("string");
    expect(body.expiresIn).toBe(60 * 60 * 24 * 30);
  });

  it("yanlış şifre 401 döner", async () => {
    const res = await worker.fetch(loginReq("yanlis"), makeEnv());
    expect(res.status).toBe(401);
    expect((await json(res)).token).toBeUndefined();
  });

  it("gövdesiz ya da bozuk istek 400 döner", async () => {
    const res = await worker.fetch(
      req("/api/login", { method: "POST", body: "bozuk{", ip: "2.2.2.2" }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });

  it("POST dışı yöntem 405 döner", async () => {
    const res = await worker.fetch(req("/api/login"), makeEnv());
    expect(res.status).toBe(405);
  });

  it("5 yanlış denemeden sonra doğru şifre bile 429 alır", async () => {
    const env = makeEnv();
    for (let i = 0; i < 5; i++) {
      const r = await worker.fetch(loginReq("yanlis", "3.3.3.3"), env);
      expect(r.status).toBe(401);
    }
    const blocked = await worker.fetch(loginReq("dogru-sifre", "3.3.3.3"), env);
    expect(blocked.status).toBe(429);
  });

  it("başka IP engellenmez", async () => {
    const env = makeEnv();
    for (let i = 0; i < 5; i++) await worker.fetch(loginReq("yanlis", "4.4.4.4"), env);
    const other = await worker.fetch(loginReq("dogru-sifre", "5.5.5.5"), env);
    expect(other.status).toBe(200);
  });

  it("başarılı giriş hata sayacını sıfırlar", async () => {
    const env = makeEnv();
    for (let i = 0; i < 4; i++) await worker.fetch(loginReq("yanlis", "6.6.6.6"), env);
    expect((await worker.fetch(loginReq("dogru-sifre", "6.6.6.6"), env)).status).toBe(200);
    for (let i = 0; i < 4; i++) {
      expect((await worker.fetch(loginReq("yanlis", "6.6.6.6"), env)).status).toBe(401);
    }
  });

  it("şifre ya da anahtar tanımsızsa 500 döner", async () => {
    const res = await worker.fetch(
      loginReq("dogru-sifre"),
      makeEnv({ APP_PASSWORD: "" }),
    );
    expect(res.status).toBe(500);
  });
});

describe("korumalı uç: /api/me", () => {
  it("token olmadan 401", async () => {
    const res = await worker.fetch(req("/api/me"), makeEnv());
    expect(res.status).toBe(401);
  });

  it("geçerli token ile 200", async () => {
    const env = makeEnv();
    const { token } = (await json(await worker.fetch(loginReq("dogru-sifre"), env))) as {
      token: string;
    };
    const res = await worker.fetch(
      req("/api/me", { headers: { Authorization: `Bearer ${token}` } }),
      env,
    );
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });

  it("bozuk token ile 401", async () => {
    const res = await worker.fetch(
      req("/api/me", { headers: { Authorization: "Bearer x.y" } }),
      makeEnv(),
    );
    expect(res.status).toBe(401);
  });

  it("Bearer olmayan başlık 401", async () => {
    const res = await worker.fetch(
      req("/api/me", { headers: { Authorization: "Basic abc" } }),
      makeEnv(),
    );
    expect(res.status).toBe(401);
  });
});

describe("CORS", () => {
  it("izinli adres başlık alır", async () => {
    const res = await worker.fetch(
      req("/api/health", { headers: { Origin: "https://kullanici.github.io" } }),
      makeEnv(),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://kullanici.github.io",
    );
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("izinsiz adres başlık almaz", async () => {
    const res = await worker.fetch(
      req("/api/health", { headers: { Origin: "https://kotu.example" } }),
      makeEnv(),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS ön kontrolü 204 ve izinli başlıklarla döner", async () => {
    const res = await worker.fetch(
      req("/api/layout", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
  });

  it("hata yanıtları da CORS başlığı taşır", async () => {
    const res = await worker.fetch(
      loginReq("yanlis", "7.7.7.7", "http://localhost:5173"),
      makeEnv(),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });
});

describe("bilinmeyen yol", () => {
  it("404 döner", async () => {
    const res = await worker.fetch(req("/api/yok"), makeEnv());
    expect(res.status).toBe(404);
  });
});
