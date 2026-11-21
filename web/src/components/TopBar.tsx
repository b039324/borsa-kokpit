import { useAuth } from "../auth";
import { useLayout } from "../layout/LayoutProvider";
import { useTheme } from "../theme";
import { MarketStrip } from "./MarketStrip";
import { SystemTest } from "./SystemTest";

interface Props {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

const SAVE_TEXT = { idle: "", saving: "Kaydediliyor…", error: "Düzen kaydedilemedi" } as const;

export function TopBar({ drawerOpen, onToggleDrawer }: Props) {
  const { signOut } = useAuth();
  const { saveState } = useLayout();
  const { theme, toggle } = useTheme();
  return (
    <header className="topbar">
      <strong>Borsa Kokpit</strong>
      <MarketStrip />
      <div className="topbar-right">
        <span className={saveState === "error" ? "save-state error" : "save-state muted"} role="status">
          {SAVE_TEXT[saveState]}
        </span>
        <SystemTest />
        <button
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="module-drawer"
          onClick={onToggleDrawer}
        >
          Modül ekle/çıkar
        </button>
        <button
          type="button"
          className="theme-toggle"
          aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
          title={theme === "dark" ? "Açık tema" : "Koyu tema"}
          onClick={toggle}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button type="button" onClick={signOut}>
          Çıkış
        </button>
      </div>
    </header>
  );
}
