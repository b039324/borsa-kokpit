import { useEffect, useState } from "react";
import { searchSymbols, type SearchHit } from "../api";
import { SYMBOL_LISTS, type ListKey } from "../data/symbols";
import { useFavorites } from "../favorites";
import { useSelection } from "../selection";
import { getToken } from "../storage";

const TABS: { key: ListKey; label: string }[] = [
  { key: "BIST30", label: "BIST 30" },
  { key: "BIST100", label: "BIST 100" },
];

type SearchFn = (q: string) => Promise<SearchHit[]>;
const defaultSearch: SearchFn = (q) => searchSymbols(getToken() ?? "", q);

interface Props {
  lists?: Record<ListKey, string[]>;
  search?: SearchFn;
  debounceMs?: number;
}

type Remote =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error" }
  | { state: "done"; hits: SearchHit[] };

function Row({ symbol, label, title }: { symbol: string; label?: React.ReactNode; title?: string }) {
  const { selected, select } = useSelection();
  const fav = useFavorites();
  const on = fav.has(symbol);
  return (
    <div className="sym-row">
      <button
        type="button"
        className="symbol"
        title={title}
        aria-pressed={selected === symbol}
        onClick={() => select(symbol)}
      >
        {label ?? symbol}
      </button>
      {fav.status === "ready" && (
        <button
          type="button"
          className={on ? "star" : "star off"}
          aria-label={on ? `${symbol} favoriden çıkar` : `${symbol} favoriye ekle`}
          aria-pressed={on}
          disabled={!on && fav.full}
          title={!on && fav.full ? "Favori sınırına ulaşıldı (50)" : undefined}
          onClick={() => fav.toggle(symbol)}
        >
          {on ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}

export function Sidebar({ lists = SYMBOL_LISTS, search = defaultSearch, debounceMs = 350 }: Props) {
  const [tab, setTab] = useState<ListKey>("BIST30");
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Remote>({ state: "idle" });
  const fav = useFavorites();

  const all = lists[tab];
  const q = query.trim().toUpperCase();
  const items = all.filter((s) => s.includes(q));

  // Listede olmayan hisseler için isimle arama: yazmayı bırakınca, eski istek yenisini ezmeden.
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) {
      setRemote({ state: "idle" });
      return;
    }
    let cancelled = false;
    setRemote({ state: "loading" });
    const timer = setTimeout(() => {
      search(term).then(
        (hits) => !cancelled && setRemote({ state: "done", hits }),
        () => !cancelled && setRemote({ state: "error" }),
      );
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, search, debounceMs]);

  const shown = new Set(items);
  const extra = remote.state === "done" ? remote.hits.filter((h) => !shown.has(h.symbol)) : [];

  return (
    <aside className="sidebar">
      <input
        type="search"
        aria-label="Hisse ara"
        placeholder="Hisse ara (kod veya isim)"
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
          <p className="muted">Listede eşleşen hisse yok.</p>
        ) : (
          items.map((s) => <Row key={s} symbol={s} />)
        )}
      </div>
      {term.length >= 2 && (
        <div className="list" aria-label="Arama sonuçları">
          <h2>Diğer hisseler</h2>
          {remote.state === "loading" && <p className="muted">Aranıyor…</p>}
          {remote.state === "error" && <p className="muted">Arama başarısız.</p>}
          {remote.state === "done" && extra.length === 0 && (
            <p className="muted">Başka sonuç yok.</p>
          )}
          {extra.map((h) => (
            <Row
              key={h.symbol}
              symbol={h.symbol}
              title={h.name}
              label={
                <>
                  {h.symbol} <span className="muted">{h.name}</span>
                </>
              }
            />
          ))}
        </div>
      )}
      <h2>Favoriler</h2>
      {fav.status === "error" ? (
        <p className="muted">Favoriler yüklenemedi.</p>
      ) : fav.symbols.length === 0 ? (
        <p className="muted">Henüz favori yok.</p>
      ) : (
        <div className="list" aria-label="Favoriler">
          {fav.symbols.map((s) => (
            <Row key={`fav-${s}`} symbol={s} />
          ))}
        </div>
      )}
    </aside>
  );
}
