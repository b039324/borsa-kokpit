import { useAuth } from "../auth";
import { useLayout } from "../layout/LayoutProvider";
import { MarketStrip } from "./MarketStrip";

interface Props {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

const SAVE_TEXT = { idle: "", saving: "Kaydediliyor…", error: "Düzen kaydedilemedi" } as const;

export function TopBar({ drawerOpen, onToggleDrawer }: Props) {
  const { signOut } = useAuth();
  const { saveState } = useLayout();
  return (
    <header className="topbar">
      <strong>Borsa Kokpit</strong>
      <MarketStrip />
      <div className="topbar-right">
        <span className={saveState === "error" ? "save-state error" : "save-state muted"} role="status">
          {SAVE_TEXT[saveState]}
        </span>
        <button
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="module-drawer"
          onClick={onToggleDrawer}
        >
          Modül ekle/çıkar
        </button>
        <button type="button" onClick={signOut}>
          Çıkış
        </button>
      </div>
    </header>
  );
}
