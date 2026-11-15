import { useState } from "react";
import { SYMBOL_LISTS, type ListKey } from "../data/symbols";
import { useSelection } from "../selection";

const TABS: { key: ListKey; label: string }[] = [
  { key: "BIST30", label: "BIST 30" },
  { key: "BIST100", label: "BIST 100" },
];

export function Sidebar({ lists = SYMBOL_LISTS }: { lists?: Record<ListKey, string[]> }) {
  const [tab, setTab] = useState<ListKey>("BIST30");
  const [query, setQuery] = useState("");
  const { selected, select } = useSelection();

  const all = lists[tab];
  const q = query.trim().toUpperCase();
  const items = all.filter((s) => s.includes(q));

  return (
    <aside className="sidebar">
      <input
        type="search"
        aria-label="Hisse ara"
        placeholder="Hisse ara (örn. THYAO)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div role="tablist" className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="list">
        {all.length === 0 ? (
          <p className="muted">Hisse listesi henüz yüklenmedi.</p>
        ) : items.length === 0 ? (
          <p className="muted">Eşleşen hisse yok.</p>
        ) : (
          items.map((s) => (
            <button
              key={s}
              type="button"
              className="symbol"
              aria-pressed={selected === s}
              onClick={() => select(s)}
            >
              {s}
            </button>
          ))
        )}
      </div>
      <h2>Favoriler</h2>
      <p className="muted">Henüz favori yok.</p>
    </aside>
  );
}
