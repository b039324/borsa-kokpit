import type { ModuleDef, ModuleProps } from "./types";

// ÖRNEK modül (sistemi denemek için). Gerçek modüller gelince bu dosya silinebilir.
function OrnekHisse({ symbol }: ModuleProps) {
  return (
    <div className="sample">
      <div className="muted">Seçili hisse</div>
      <div className="sample-big">{symbol}</div>
    </div>
  );
}

const def: ModuleDef = {
  id: "ornek-hisse",
  title: "Örnek: seçili hisse",
  scope: "stock",
  defaultSize: { w: 14, h: 8 },
  minSize: { w: 8, h: 5 },
  order: 900,
  component: OrnekHisse,
};

export default def;
