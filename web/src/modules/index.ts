import { createRegistry } from "./registry";
import type { ModuleDef } from "./types";

// src/modules/ altındaki tüm *.module.tsx dosyaları otomatik kayıt olur.
const files = import.meta.glob<{ default: ModuleDef }>("./*.module.tsx", { eager: true });

export const registry = createRegistry(Object.values(files).map((m) => m.default));
