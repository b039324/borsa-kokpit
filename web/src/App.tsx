import { AuthProvider, useAuth } from "./auth";
import { SelectionProvider } from "./selection";
import { LoginPage } from "./components/LoginPage";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";

function Shell() {
  return (
    <SelectionProvider>
      <div className="shell">
        <TopBar />
        <div className="body">
          <Sidebar />
          <Canvas />
        </div>
      </div>
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
