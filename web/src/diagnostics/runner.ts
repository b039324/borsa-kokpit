import { isMarketOpen } from "../market/session";
import { SEVERITY, type Check, type CheckResult, type ModuleResult, type ModuleSpec, type Report, type Status } from "./types";

interface Options {
  checks: Check[];
  modules: ModuleSpec[];
  sample?: string;
  now?: () => number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

function errorText(e: unknown): string {
  if (e instanceof Error) {
    const status = (e as { status?: number }).status;
    return status ? `${e.message} (HTTP ${status})` : e.message;
  }
  return "Bilinmeyen hata";
}

function worst(list: Status[]): Status {
  return list.reduce<Status>((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "ok");
}

export async function runDiagnostics({ checks, modules, sample = "", now = Date.now, onProgress, signal }: Options): Promise<Report> {
  const startedAt = new Date().toISOString();
  const results: CheckResult[] = [];

  for (const c of checks) {
    if (signal?.aborted) break;
    const t0 = now();
    let out;
    try {
      out = await c.run();
    } catch (e) {
      out = { status: "fail" as const, detail: errorText(e) };
    }
    results.push({ id: c.id, label: c.label, ...out, ms: now() - t0 });
    onProgress?.(results.length, checks.length);
  }

  const byId = new Map(results.map((r) => [r.id, r]));
  const moduleResults: ModuleResult[] = modules.map((m) => {
    if (m.checks.length === 0) return { ...m, status: "ok", detail: "Dış veri gerektirmez" };
    const found = m.checks.map((id) => byId.get(id));
    if (found.some((r) => !r)) {
      return { ...m, status: "warn", detail: "Bağlı kontrol çalışmadı (test iptal edildi ya da tanımsız)" };
    }
    const rs = found as CheckResult[];
    const status = worst(rs.map((r) => r.status));
    const notable = rs.filter((r) => r.status !== "ok");
    const detail =
      notable.length === 0 && rs.length > 1
        ? `${rs.length}/${rs.length} kontrol tamam`
        : (notable.length ? notable : rs).map((r) => (rs.length > 1 ? `${r.label}: ${r.detail}` : r.detail)).join(" · ");
    return { ...m, status, detail };
  });

  const counts: Record<Status, number> = { ok: 0, warn: 0, fail: 0, manual: 0 };
  for (const m of moduleResults) counts[m.status]++;

  return { startedAt, sample, marketOpen: isMarketOpen(new Date()), checks: results, modules: moduleResults, counts };
}
