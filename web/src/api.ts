import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message = "Sunucuya ulaşılamadı") {
    super(message);
    this.name = "NetworkError";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new NetworkError();
  }
}

export async function login(
  password: string,
): Promise<{ token: string; expiresIn: number }> {
  const res = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return res.json();
  let message = "Giriş yapılamadı";
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    /* varsayılan mesaj kalır */
  }
  throw new ApiError(res.status, message);
}

// true: oturum geçerli, false: token geçersiz/süresi dolmuş, hata: sunucu sorunu
export async function checkSession(token: string): Promise<boolean> {
  const res = await request("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return true;
  if (res.status === 401) return false;
  throw new ApiError(res.status, "Sunucu hatası");
}
