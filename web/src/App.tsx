import { useCallback, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import { SelectionProvider } from "./selection";
import { FavoritesProvider } from "./favorites";
import { AlarmsProvider } from "./alarms";
import { LayoutProvider } from "./layout/LayoutProvider";
import { LoginPage } from "./components/LoginPage";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { ModuleDrawer } from "./components/ModuleDrawer";

function ShellInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  return (
    <div className="shell">
      <TopBar drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen((o) => !o)} />
      <div className="body">
        <Sidebar />
        <div className="stage">
          <Canvas />
          {drawerOpen && <ModuleDrawer onClose={closeDrawer} />}
        </div>
      </div>
    </div>
  );
}

function Shell() {
  return (
    <SelectionProvider>
      <FavoritesProvider>
        <AlarmsProvider>
          <LayoutProvider>
            <ShellInner />
          </LayoutProvider>
        </AlarmsProvider>
      </FavoritesProvider>
    </SelectionProvider>
  );
}

function Gate() {
  const { status, retry } = useAuth();
  if (status === "checking") return <div className="center muted">Yükleniyor…</div>;
  if (status === "unreachable") {
    return (
      <div className="center">
        <p>Sunucuya ulaşılamadı.</p>
        <button type="button" onClick={retry}>
          Tekrar dene
        </button>
      </div>
    );
  }
  if (status === "loggedOut") return <LoginPage />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
