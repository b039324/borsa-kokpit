import type { Registry } from "../modules/registry";
import type { SizedModule } from "./model";

export interface Template {
  key: string;
  label: string;
  modules: string[]; // modül id'leri, yerleşim sırasıyla
}

// Hazır sayfa düzenleri. Yeni şablon için buraya satır eklemek yeter; id'ler testle doğrulanır.
export const TEMPLATES: Template[] = [
  {
    key: "hisse",
    label: "Hisse",
    modules: ["grafik", "fiyat-ozeti", "teknik", "sinyal", "destek-direnc", "temel", "risk"],
  },
  {
    key: "piyasa",
    label: "Piyasa",
    modules: ["isi-haritasi", "en-cok-hareket", "piyasa-genisligi", "hacim-patlamasi", "seans-durumu"],
  },
  {
    key: "analiz",
    label: "Analiz",
    modules: ["goreli-guc", "karsilastirma", "getiri-donemleri", "mum-formasyonu", "volatilite-siralamasi"],
  },
];

// Şablondaki modülleri kayıt defterinden çözer; kayıtlı olmayanı atar.
export function resolveTemplate(t: Template, registry: Pick<Registry, "get">): SizedModule[] {
  const out: SizedModule[] = [];
  for (const id of t.modules) {
    const def = registry.get(id);
    if (def) out.push({ id: def.id, defaultSize: def.defaultSize });
  }
  return out;
}
