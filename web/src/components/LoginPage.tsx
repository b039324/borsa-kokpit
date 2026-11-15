import { useState, type FormEvent } from "react";
import { ApiError, NetworkError } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Şifreyi gir");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(password);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof NetworkError) setError("Sunucuya ulaşılamadı. Bağlantını kontrol et.");
      else setError("Giriş yapılamadı");
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="login" onSubmit={onSubmit}>
        <h1>Borsa Kokpit</h1>
        <label htmlFor="password">Şifre</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="primary">
          {busy ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
