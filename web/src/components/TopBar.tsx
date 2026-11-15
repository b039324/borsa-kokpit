import { useAuth } from "../auth";

export function TopBar() {
  const { signOut } = useAuth();
  return (
    <header className="topbar">
      <strong>Borsa Kokpit</strong>
      <button type="button" onClick={signOut}>
        Çıkış
      </button>
    </header>
  );
}
