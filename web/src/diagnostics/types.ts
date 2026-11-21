export type Status = "ok" | "warn" | "fail" | "manual";

export interface Outcome { status: Status; detail: string }
export interface Check { id: string; label: string; run: () => Promise<Outcome> }
export interface CheckResult extends Outcome { id: string; label: string; ms: number }
export interface ModuleSpec { id: string; title: string; checks: string[] }
export interface ModuleResult { id: string; title: string; checks: string[]; status: Status; detail: string }

export interface Report {
  startedAt: string; // ISO
  sample: string; // örnek hisse
  marketOpen: boolean;
  checks: CheckResult[];
  modules: ModuleResult[];
  counts: Record<Status, number>; // modül sayısı
}

// Kötüden iyiye: fail > warn > manual > ok
export const SEVERITY: Record<Status, number> = { ok: 0, manual: 1, warn: 2, fail: 3 };
export const STATUS_ICON: Record<Status, string> = { ok: "✓", warn: "⚠", fail: "✗", manual: "👁" };
export const STATUS_TEXT: Record<Status, string> = { ok: "tamam", warn: "uyarı", fail: "hata", manual: "elle kontrol" };
