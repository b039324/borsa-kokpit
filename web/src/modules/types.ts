import type { ComponentType } from "react";

// Her modül bu arayüze uyar. Yeni modül eklemek = src/modules/ altına
// <ad>.module.tsx dosyası koyup bir ModuleDef'i default export etmek. Başka yere dokunmak gerekmez.
export interface ModuleProps {
  // Seçili hisse. "stock" kapsamlı modüller yalnız hisse seçiliyken çizilir.
  symbol: string | null;
}

export interface ModuleDef {
  // Küçük harf, rakam ve tire. Kayıtlı düzenle eşleştiği için sonradan DEĞİŞTİRME.
  id: string;
  title: string;
  // stock: seçili hisseye bağlı, global: hisseden bağımsız
  scope: "stock" | "global";
  // Izgara hücresi cinsinden (1 hücre = 20px)
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  // Çekmecedeki sıra (küçük olan önce). Verilmezse sona gider.
  order?: number;
  component: ComponentType<ModuleProps>;
}
