import type { Env, KVLike } from "../src/types";

export function makeKV(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    APP_PASSWORD: "dogru-sifre",
    TOKEN_SECRET: "test-gizli-anahtar-en-az-32-karakter!!",
    ALLOWED_ORIGIN: "http://localhost:5173,https://kullanici.github.io",
    KOKPIT: makeKV(),
    ...overrides,
  };
}

export function req(
  path: string,
  init: RequestInit & { ip?: string } = {},
): Request {
  const { ip, headers, ...rest } = init;
  const h = new Headers(headers);
  if (ip) h.set("CF-Connecting-IP", ip);
  return new Request(`https://api.test${path}`, { ...rest, headers: h });
}

export function loginReq(password: string, ip = "1.1.1.1", origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers["Origin"] = origin;
  return req("/api/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ password }),
    ip,
  });
}
