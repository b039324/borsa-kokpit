import type { Env } from "./types";
import { allowedOrigin, withCors } from "./cors";
import { isAuthenticated, safeEqual, signToken } from "./auth";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_FAILED_LOGINS = 5;
const LOCK_SECONDS = 15 * 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Yöntem desteklenmiyor" }, 405);
  if (!env.APP_PASSWORD || !env.TOKEN_SECRET) {
    return json({ error: "Sunucu yapılandırılmamış" }, 500);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "bilinmiyor";
  const key = `rl:${ip}`;
  const failed = parseInt((await env.KOKPIT.get(key)) ?? "0", 10) || 0;
  if (failed >= MAX_FAILED_LOGINS) {
    return json({ error: "Çok fazla hatalı deneme. Biraz sonra tekrar dene." }, 429);
  }

  let password: unknown;
  try {
    ({ password } = (await request.json()) as { password?: unknown });
  } catch {
    return json({ error: "Geçersiz istek" }, 400);
  }
  if (typeof password !== "string") return json({ error: "Geçersiz istek" }, 400);

  if (!(await safeEqual(password, env.APP_PASSWORD))) {
    await env.KOKPIT.put(key, String(failed + 1), { expirationTtl: LOCK_SECONDS });
    return json({ error: "Şifre hatalı" }, 401);
  }

  await env.KOKPIT.delete(key);
  const token = await signToken(env.TOKEN_SECRET, TOKEN_TTL_SECONDS);
  return json({ token, expiresIn: TOKEN_TTL_SECONDS });
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/health") return json({ ok: true });
  if (pathname === "/api/login") return handleLogin(request, env);

  if (pathname === "/api/me") {
    if (!env.TOKEN_SECRET) return json({ error: "Sunucu yapılandırılmamış" }, 500);
    if (!(await isAuthenticated(request, env.TOKEN_SECRET))) {
      return json({ error: "Giriş gerekli" }, 401);
    }
    return json({ ok: true });
  }

  return json({ error: "Bulunamadı" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env.ALLOWED_ORIGIN ?? "");
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), origin);
    }
    try {
      return withCors(await route(request, env), origin);
    } catch {
      return withCors(json({ error: "Sunucu hatası" }, 500), origin);
    }
  },
};
