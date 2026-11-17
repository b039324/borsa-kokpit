import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, getLayout, saveLayout } from "../api";
import { useAuth } from "../auth";
import { getToken } from "../storage";
import type { ModuleDef } from "../modules/types";
import {
  activate,
  activePage,
  addTab as addTabTo,
  deactivate,
  emptyLayout,
  isActive,
  moveTab as moveTabIn,
  removeTab as removeTabFrom,
  renameTab as renameTabIn,
  sanitizeLayout,
  selectTab as selectTabIn,
  updateActivePage,
  updateRect,
  type Layout,
  type Rect,
  type Tab,
} from "./model";

export type LoadStatus = "loading" | "ready" | "error";
export type SaveState = "idle" | "saving" | "error";

interface LayoutValue {
  status: LoadStatus;
  saveState: SaveState;
  layout: Layout;
  // Etkin sayfa (sekme): modüller ve park kayıtları burada
  page: Tab;
  addTab: () => void;
  removeTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  moveTab: (id: string, overId: string) => void;
  selectTab: (id: string) => void;
  toggle: (def: ModuleDef) => void;
  close: (id: string) => void;
  commitRect: (id: string, rect: Rect) => void;
  reload: () => void;
}

const LayoutContext = createContext<LayoutValue | null>(null);

interface Props {
  children: ReactNode;
  // Son değişiklikten sonra kaydetmeden önce beklenecek süre (art arda değişiklikler birleşir)
  saveDelayMs?: number;
  // Sunucu/ağ hatasında yeniden deneme aralığı
  retryDelayMs?: number;
}

// Düzeni sunucudan yükler ve değişiklikleri kaydeder.
// Güvenlik kuralı: yükleme başarısızsa hiçbir şey kaydedilmez; böylece sunucudaki düzen
// yanlışlıkla boş bir düzenle ezilmez.
export function LayoutProvider({ children, saveDelayMs = 400, retryDelayMs = 5000 }: Props) {
  const { signOut } = useAuth();
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const layoutRef = useRef<Layout>(emptyLayout());
  const [layout, setLayout] = useState<Layout>(layoutRef.current);

  const statusRef = useRef<LoadStatus>("loading");
  const mounted = useRef(true);
  const loadId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const pending = useRef(false);
  const doSaveRef = useRef<() => Promise<void>>(async () => {});

  const setLoad = (s: LoadStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const schedule = useCallback((delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSaveRef.current(), delay);
  }, []);

  async function doSave(): Promise<void> {
    if (saving.current) {
      pending.current = true;
      return;
    }
    const token = getToken();
    if (!token) {
      signOut();
      return;
    }
    saving.current = true;
    setSaveState("saving");
    try {
      do {
        pending.current = false;
        await saveLayout(token, layoutRef.current);
      } while (pending.current);
      if (mounted.current) setSaveState("idle");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signOut();
      } else if (mounted.current) {
        setSaveState("error");
        // 4xx (401 hariç) tekrar denemekle düzelmez; ağ ve 5xx hatalarında yeniden dene.
        const retryable = !(e instanceof ApiError) || e.status >= 500;
        if (retryable) schedule(retryDelayMs);
      }
    } finally {
      saving.current = false;
    }
  }
  doSaveRef.current = doSave;

  const load = useCallback(async () => {
    const id = ++loadId.current;
    setLoad("loading");
    const token = getToken();
    if (!token) {
      signOut();
      return;
    }
    try {
      const raw = await getLayout(token);
      if (id !== loadId.current || !mounted.current) return;
      const next = sanitizeLayout(raw);
      layoutRef.current = next;
      setLayout(next);
      setLoad("ready");
    } catch (e) {
      if (id !== loadId.current || !mounted.current) return;
      if (e instanceof ApiError && e.status === 401) signOut();
      else setLoad("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signOut]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, [load]);

  const apply = useCallback(
    (fn: (l: Layout) => Layout) => {
      if (statusRef.current !== "ready") return;
      const next = fn(layoutRef.current);
      if (next === layoutRef.current) return;
      layoutRef.current = next;
      setLayout(next);
      schedule(saveDelayMs);
    },
    [saveDelayMs, schedule],
  );

  const toggle = useCallback(
    (def: ModuleDef) =>
      apply((l) =>
        updateActivePage(l, (p) =>
          isActive(p, def.id) ? deactivate(p, def.id) : activate(p, def.id, def.defaultSize),
        ),
      ),
    [apply],
  );
  const close = useCallback(
    (id: string) => apply((l) => updateActivePage(l, (p) => deactivate(p, id))),
    [apply],
  );
  const commitRect = useCallback(
    (id: string, rect: Rect) => apply((l) => updateActivePage(l, (p) => updateRect(p, id, rect))),
    [apply],
  );
  const addTab = useCallback(() => apply(addTabTo), [apply]);
  const removeTab = useCallback((id: string) => apply((l) => removeTabFrom(l, id)), [apply]);
  const renameTab = useCallback(
    (id: string, name: string) => apply((l) => renameTabIn(l, id, name)),
    [apply],
  );
  const moveTab = useCallback(
    (id: string, overId: string) => apply((l) => moveTabIn(l, id, overId)),
    [apply],
  );
  const selectTab = useCallback((id: string) => apply((l) => selectTabIn(l, id)), [apply]);

  const value = useMemo(
    () => ({
      status,
      saveState,
      layout,
      page: activePage(layout),
      addTab,
      removeTab,
      renameTab,
      moveTab,
      selectTab,
      toggle,
      close,
      commitRect,
      reload: () => void load(),
    }),
    [status, saveState, layout, addTab, removeTab, renameTab, moveTab, selectTab, toggle, close, commitRect, load],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout, LayoutProvider içinde kullanılmalı");
  return ctx;
}
