import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Seçili hisse: hisseye bağlı tüm modüller bu tek kaynaktan okur.
interface SelectionValue {
  selected: string | null;
  select: (symbol: string) => void;
}

const SelectionContext = createContext<SelectionValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const value = useMemo(() => ({ selected, select: setSelected }), [selected]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection, SelectionProvider içinde kullanılmalı");
  return ctx;
}
