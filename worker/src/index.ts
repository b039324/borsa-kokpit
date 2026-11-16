import type { Env } from "./types";
import { allowedOrigin, withCors } from "./cors";
import { isAuthenticated, safeEqual, signToken } from "./auth";
import { handleChart, handleFundamentals, handleMarket, handleQuotes, handleSearch } from "./data";
import { ALARMS_KEY, validateAlarms } from "./alarms";
import { FAVORITES_KEY, validateFavorites } from "./favorites";
import { LAYOUT_KEY, MAX_BODY_BYTES, validateLayout } from "./layout";

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

// Giriş gerektiren uçlar için ortak kapı. Geçerse null, geçmezse hazır hata yanıtı döner.
async function guard(request: Request, env: Env): Promise<Response | null> {
  if (!env.TOKEN_SECRET) return json({ error: "Sunucu yapılandırılmamış" }, 500);
  if (!(await isAuthenticated(request, env.TOKEN_SECRET))) {
    return json({ error: "Giriş gerekli" }, 401);
  }
  return null;
}

async function handleLayout(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const raw = await env.KOKPIT.get(LAYOUT_KEY);
    if (!raw) return json({ layout: null });
    try {
      const checked = validateLayout(JSON.parse(raw));
      return json({ layout: checked.ok ? checked.layout : null });
    } catch {
      return json({ layout: null });
    }
  }

  if (request.method === "PUT") {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return json({ error: "Düzen çok büyük" }, 413);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "Geçersiz JSON" }, 400);
    }
    const checked = validateLayout(parsed);
    if (!checked.ok) return json({ error: checked.error }, 400);
    await env.KOKPIT.put(LAYOUT_KEY, JSON.stringify(checked.layout));
    return json({ ok: true });
  }

  return json({ error: "Yöntem desteklenmiyor" }, 405);
}

async function handleFavorites(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const raw = await env.KOKPIT.get(FAVORITES_KEY);
    if (!raw) return json({ symbols: [] });
    try {
      const checked = validateFavorites(JSON.parse(raw));
      return json({ symbols: checked.ok ? checked.symbols : [] });
    } catch {
      return json({ symbols: [] });
    }
  }
  if (request.method === "PUT") {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 5_000) return json({ error: "Liste çok büyük" }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "Geçersiz JSON" }, 400);
    }
    const checked = validateFavorites(parsed);
    if (!checked.ok) return json({ error: checked.error }, 400);
    await env.KOKPIT.put(FAVORITES_KEY, JSON.stringify({ symbols: checked.symbols }));
    return json({ ok: true });
  }
  return json({ error: "Yöntem desteklenmiyor" }, 405);
}

async function handleAlarms(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const raw = await env.KOKPIT.get(ALARMS_KEY);
    if (!raw) return json({ alarms: [] });
    try {
      const checked = validateAlarms(JSON.parse(raw));
      return json({ alarms: checked.ok ? checked.alarms : [] });
    } catch {
      return json({ alarms: [] });
    }
  }
  if (request.method === "PUT") {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 10_000) return json({ error: "Liste çok büyük" }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "Geçersiz JSON" }, 400);
    }
    const checked = validateAlarms(parsed);
    if (!checked.ok) return json({ error: checked.error }, 400);
    await env.KOKPIT.put(ALARMS_KEY, JSON.stringify({ alarms: checked.alarms }));
    return json({ ok: true });
  }
  return json({ error: "Yöntem desteklenmiyor" }, 405);
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/health") return json({ ok: true });
  if (pathname === "/api/login") return handleLogin(request, env);

  if (pathname === "/api/me") {
    return (await guard(request, env)) ?? json({ ok: true });
  }

  if (pathname === "/api/layout") {
    return (await guard(request, env)) ?? handleLayout(request, env);
  }

  if (pathname === "/api/favorites") {
    return (await guard(request, env)) ?? handleFavorites(request, env);
  }

  if (pathname === "/api/alarms") {
    return (await guard(request, env)) ?? handleAlarms(request, env);
  }

  if (pathname === "/api/market") {
    return (await guard(request, env)) ?? handleMarket(request);
  }

  if (pathname === "/api/quotes") {
    return (await guard(request, env)) ?? handleQuotes(request);
  }

  if (pathname === "/api/fundamentals") {
    return (await guard(request, env)) ?? handleFundamentals(request);
  }

  if (pathname === "/api/chart") {
    return (await guard(request, env)) ?? handleChart(request);
  }

  if (pathname === "/api/search") {
    return (await guard(request, env)) ?? handleSearch(request);
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
