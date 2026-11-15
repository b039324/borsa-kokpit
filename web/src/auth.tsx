import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { checkSession, login } from "./api";
import { clearToken, getToken, saveToken } from "./storage";

export type AuthStatus = "checking" | "loggedOut" | "loggedIn" | "unreachable";

interface AuthValue {
  status: AuthStatus;
  signIn: (password: string) => Promise<void>;
  signOut: () => void;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? "checking" : "loggedOut",
  );

  const verify = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStatus("loggedOut");
      return;
    }
    setStatus("checking");
    try {
      if (await checkSession(token)) {
        setStatus("loggedIn");
      } else {
        clearToken();
        setStatus("loggedOut");
      }
    } catch {
      // Sunucuya ulaşılamadı ya da sunucu hatası: token'ı silme, tekrar denemeye izin ver.
      setStatus("unreachable");
    }
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  const signIn = useCallback(async (password: string) => {
    const { token } = await login(password);
    saveToken(token);
    setStatus("loggedIn");
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setStatus("loggedOut");
  }, []);

  const value = useMemo(
    () => ({ status, signIn, signOut, retry: () => void verify() }),
    [status, signIn, signOut, verify],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  return ctx;
}
