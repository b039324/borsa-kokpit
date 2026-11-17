import { useEffect } from "react";
import { isActive } from "../layout/model";
import { useLayout } from "../layout/LayoutProvider";
import { registry as defaultRegistry } from "../modules";
import type { Registry } from "../modules/registry";

const SCOPE_LABEL = { stock: "hisseye bağlı", global: "bağımsız" } as const;

export function ModuleDrawer({
  onClose,
  registry = defaultRegistry,
}: {
  onClose: () => void;
  registry?: Registry;
}) {
  const { status, page, toggle } = useLayout();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeCount = registry.list.filter((d) => isActive(page, d.id)).length;

  return (
    <aside className="drawer" role="dialog" aria-label="Modül ekle/çıkar" id="module-drawer">
      <div className="drawer-head">
        <strong>Modüller</strong>
        <button type="button" aria-label="Kapat" onClick={onClose}>
          ×
        </button>
      </div>
      {status === "loading" && <p className="muted">Modüller yükleniyor…</p>}
      {status === "error" && <p className="muted">Düzen yüklenemedi.</p>}
      {status === "ready" && (
        <>
          <ul className="drawer-list">
            {registry.list.map((def) => (
              <li key={def.id}>
                <label>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={def.title}
                    checked={isActive(page, def.id)}
                    onChange={() => toggle(def)}
                  />
                  <span className="drawer-name">{def.title}</span>
                  <small className="muted">{SCOPE_LABEL[def.scope]}</small>
                </label>
              </li>
            ))}
          </ul>
          <p className="muted">Sayfa: {page.name}</p>
          <p className="muted">
            {activeCount}/{registry.list.length} modül açık
          </p>
        </>
      )}
    </aside>
  );
}
