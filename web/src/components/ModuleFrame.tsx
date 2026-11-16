import type { ModuleDef } from "../modules/types";
import { ErrorBoundary } from "./ErrorBoundary";

interface Props {
  def: ModuleDef;
  symbol: string | null;
  onClose: (id: string) => void;
}

// Her modülün ortak çerçevesi: başlık (sürükleme tutamacı), kapat düğmesi, hata sınırı.
export function ModuleFrame({ def, symbol, onClose }: Props) {
  const Body = def.component;
  const needsSymbol = def.scope === "stock" && !symbol;
  return (
    <section className="module" aria-label={def.title}>
      <header className="module-head">
        <span className="module-title">{def.title}</span>
        <button
          type="button"
          className="module-close"
          aria-label={`Kapat: ${def.title}`}
          onClick={() => onClose(def.id)}
        >
          ×
        </button>
      </header>
      <div className="module-body">
        {needsSymbol ? (
          <p className="muted">Bir hisse seç.</p>
        ) : (
          <ErrorBoundary resetKey={symbol}>
            <Body symbol={symbol} />
          </ErrorBoundary>
        )}
      </div>
    </section>
  );
}
