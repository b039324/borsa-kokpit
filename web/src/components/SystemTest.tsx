import { useCallback, useEffect, useRef, useState } from "react";
import { buildChecks, buildModuleSpecs } from "../diagnostics/checks";
import { toCsv, toMarkdown } from "../diagnostics/report";
import { runDiagnostics } from "../diagnostics/runner";
import { SEVERITY, STATUS_ICON, STATUS_TEXT, type Report } from "../diagnostics/types";
import { registry } from "../modules";
import { useSelection } from "../selection";
import { getToken } from "../storage";

export type RunFn = (o: { token: string; sample: string; onProgress: (done: number, total: number) => void; signal: AbortSignal }) => Promise<Report>;

const defaultRun: RunFn = ({ token, sample, onProgress, signal }) =>
  runDiagnostics({
    checks: buildChecks(token, sample),
    modules: buildModuleSpecs(registry.list),
    sample,
    onProgress,
    signal,
  });

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

export function SystemTest({ run = defaultRun }: { run?: RunFn }) {
  const { selected } = useSelection();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runId = useRef(0);

  const start = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const id = ++runId.current;
    setReport(null);
    setError(null);
    setCopied(false);
    setProgress([0, 0]);
    run({
      token: getToken() ?? "",
      sample: selected ?? "AKBNK",
      onProgress: (d, n) => { if (id === runId.current) setProgress([d, n]); },
      signal: ac.signal,
    })
      .then((r) => { if (id === runId.current && !ac.signal.aborted) setReport(r); })
      .catch((e) => { if (id === runId.current && !ac.signal.aborted) setError(e instanceof Error ? e.message : "Tarama başarısız"); });
  }, [run, selected]);

  const close = useCallback(() => {
    runId.current++;
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const rows = report ? [...report.modules].sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]) : [];
  const [done, total] = progress;

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); start(); }}>Sistem testi</button>
      {open && (
        <div className="st-backdrop" onClick={close}>
          <div className="st-dialog" role="dialog" aria-modal="true" aria-label="Sistem testi" onClick={(e) => e.stopPropagation()}>
            <h2>Sistem testi</h2>
            {error ? (
              <p role="alert" className="st-error">Tarama başarısız: {error}</p>
            ) : !report ? (
              <div className="st-progress">
                <p>Modüller taranıyor… <span>{done}/{total || "…"}</span></p>
                <div role="progressbar" aria-label="Tarama ilerlemesi" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="st-bar">
                  <div style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
                </div>
              </div>
            ) : (
              <>
                <p className="st-summary">
                  {report.counts.ok} tamam · {report.counts.warn} uyarı · {report.counts.fail} hata · {report.counts.manual} elle kontrol
                </p>
                {!report.marketOpen && <p className="muted st-note">Piyasa kapalı: fiyatlar son seansa aittir, bu hata sayılmaz.</p>}
                <ul className="st-list">
                  {rows.map((m) => (
                    <li key={m.id} data-testid="st-row" className={`st-${m.status}`}>
                      <span className="st-icon" title={STATUS_TEXT[m.status]}>{STATUS_ICON[m.status]}</span>
                      <strong>{m.title}</strong>
                      <span className="muted"> {m.detail}</span>
                    </li>
                  ))}
                </ul>
                <details className="st-checks">
                  <summary>Tüm kontroller ({report.checks.length})</summary>
                  <ul>
                    {report.checks.map((c) => (
                      <li key={c.id}>{STATUS_ICON[c.status]} {c.label} <span className="muted">· {c.ms} ms · {c.detail}</span></li>
                    ))}
                  </ul>
                </details>
              </>
            )}
            <div className="st-actions">
              {report && (
                <>
                  <button type="button" onClick={() => download(`sistem-testi-${dayOf(report.startedAt)}.md`, toMarkdown(report), "text/markdown;charset=utf-8")}>Markdown indir</button>
                  <button type="button" onClick={() => download(`sistem-testi-${dayOf(report.startedAt)}.csv`, toCsv(report), "text/csv;charset=utf-8")}>CSV indir</button>
                  <button
                    type="button"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(toMarkdown(report)); setCopied(true); } catch { setCopied(false); }
                    }}
                  >
                    Panoya kopyala
                  </button>
                  {copied && <span role="status" className="muted">Kopyalandı</span>}
                </>
              )}
              {(report || error) && <button type="button" onClick={start}>Yeniden tara</button>}
              <button type="button" onClick={close}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
