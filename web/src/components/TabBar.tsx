import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useLayout } from "../layout/LayoutProvider";
import { MAX_TABS, MAX_TAB_NAME } from "../layout/model";
import { TEMPLATES, resolveTemplate } from "../layout/templates";
import { registry as defaultRegistry } from "../modules";
import type { Registry } from "../modules/registry";

const DRAG_TYPE = "text/plain";

// Sayfa sekmeleri: tıkla = seç, çift tıkla = yeniden adlandır, sürükle = sırala, × = sil, + = yeni boş sayfa.
export function TabBar({ registry = defaultRegistry }: { registry?: Registry }) {
  const { status, layout, addTab, removeTab, renameTab, moveTab, selectTab } = useLayout();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  // Enter/Escape ile çıkınca ardından gelen blur ikinci kez kaydetmesin.
  const done = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // "+" menüsü: Escape ya da dışarı tıklayınca kapanır.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen]);

  if (status !== "ready") return null;
  const single = layout.tabs.length <= 1;

  const startEdit = (id: string, name: string) => {
    done.current = false;
    setDraft(name);
    setEditing(id);
  };
  const finishEdit = (save: boolean) => {
    if (done.current || editing === null) return;
    done.current = true;
    if (save) renameTab(editing, draft);
    setEditing(null);
  };

  const remove = (id: string, name: string, count: number) => {
    if (count > 0 && !window.confirm(`“${name}” sayfası ve içindeki ${count} modül silinsin mi?`)) return;
    removeTab(id);
  };

  const onKey = (e: KeyboardEvent, id: string, name: string) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectTab(id);
    } else if (e.key === "F2") {
      startEdit(id, name);
    }
  };

  const onDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData(DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
  };
  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const from = dragId ?? e.dataTransfer.getData(DRAG_TYPE);
    setDragId(null);
    setOverId(null);
    if (from) moveTab(from, targetId);
  };

  return (
    <div className="tabbar" role="tablist" aria-label="Sayfalar">
      {layout.tabs.map((t) => {
        const selected = t.id === layout.active;
        const isEditing = editing === t.id;
        const cls = ["tab", selected && "tab-active", overId === t.id && dragId !== t.id && "tab-over"]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={selected}
            tabIndex={0}
            className={cls}
            draggable={!isEditing}
            onClick={() => selectTab(t.id)}
            onDoubleClick={() => startEdit(t.id, t.name)}
            onKeyDown={(e) => onKey(e, t.id, t.name)}
            onDragStart={(e) => onDragStart(e, t.id)}
            onDragOver={(e) => {
              if (dragId === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverId(t.id);
            }}
            onDragLeave={() => setOverId((o) => (o === t.id ? null : o))}
            onDrop={(e) => onDrop(e, t.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="tab-input"
                aria-label="Sayfa adı"
                value={draft}
                maxLength={MAX_TAB_NAME}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") finishEdit(true);
                  else if (e.key === "Escape") finishEdit(false);
                }}
                onBlur={() => finishEdit(true)}
              />
            ) : (
              <span className="tab-name">{t.name}</span>
            )}
            {!single && !isEditing && (
              <button
                type="button"
                className="tab-close"
                aria-label={`${t.name} sayfasını sil`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(t.id, t.name, t.items.length);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <div className="tab-add-wrap" ref={addRef}>
        <button
          type="button"
          className="tab-add"
          aria-label="Yeni sayfa"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={layout.tabs.length >= MAX_TABS ? `En çok ${MAX_TABS} sayfa` : "Yeni sayfa"}
          disabled={layout.tabs.length >= MAX_TABS}
          onClick={() => setMenuOpen((o) => !o)}
        >
          +
        </button>
        {menuOpen && (
          <div className="tab-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                addTab();
              }}
            >
              Boş sayfa
            </button>
            {TEMPLATES.map((t) => {
              const defs = resolveTemplate(t, registry);
              return (
                <button
                  key={t.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    addTab({ name: t.label, defs });
                  }}
                >
                  {t.label} <span className="muted">({defs.length} modül)</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
