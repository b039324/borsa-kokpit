import type { ModuleDef } from "./types";

const ID_RE = /^[a-z0-9-]{1,64}$/;
const DEFAULT_ORDER = 1000;

export interface Registry {
  list: ModuleDef[];
  get: (id: string) => ModuleDef | undefined;
}

function validSize(s: { w: number; h: number }): boolean {
  return Number.isInteger(s.w) && Number.isInteger(s.h) && s.w >= 1 && s.h >= 1;
}

export function createRegistry(defs: ModuleDef[]): Registry {
  const byId = new Map<string, ModuleDef>();
  for (const d of defs) {
    if (!ID_RE.test(d.id)) {
      throw new Error(`Geçersiz modül id'si: "${d.id}" (küçük harf, rakam ve tire kullan)`);
    }
    if (byId.has(d.id)) throw new Error(`Aynı modül id'si iki kez kayıtlı: "${d.id}"`);
    if (!validSize(d.defaultSize) || (d.minSize && !validSize(d.minSize))) {
      throw new Error(`Geçersiz modül boyutu: "${d.id}"`);
    }
    byId.set(d.id, d);
  }
  const list = [...byId.values()].sort(
    (a, b) =>
      (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER) ||
      a.title.localeCompare(b.title, "tr"),
  );
  return { list, get: (id) => byId.get(id) };
}
