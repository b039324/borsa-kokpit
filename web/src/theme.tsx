import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";
export const THEME_KEY = "kokpit_tema";

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue>({ theme: "dark", toggle: () => {} });

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* depolama kapalı */
  }
  try {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    /* eski tarayıcı */
  }
  return "dark";
}

// Tema bu cihaza özeldir (tarayıcıda saklanır); düzenler gibi sunucuya yazılmaz.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* kaydedilemese de tema değişir */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
