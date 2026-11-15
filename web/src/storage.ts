import { TOKEN_KEY } from "./config";

// Gizli sekme gibi durumlarda localStorage hata verebilir; hepsi güvenli sarmalandı.
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* kaydedilemezse oturum yalnız bu sayfa açıkken geçerli kalır */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* yok say */
  }
}
