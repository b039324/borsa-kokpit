import { STATUS_ICON, STATUS_TEXT, type Report } from "./types";

const md = (s: string) => s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
const csvCell = (s: string | number) => {
  const t = String(s).replace(/\r?\n/g, " ");
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toMarkdown(r: Report): string {
  const c = r.counts;
  const when = new Date(r.startedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const lines = [
    "# Sistem testi raporu",
    "",
    `- Tarih: ${when}`,
    `- Örnek hisse: ${r.sample}`,
    `- Özet (modül): ${c.ok} tamam · ${c.warn} uyarı · ${c.fail} hata · ${c.manual} elle kontrol`,
  ];
  if (!r.marketOpen) lines.push("- Not: Piyasa kapalıydı; fiyatlar son seansa aittir, bu hata sayılmaz.");
  lines.push("", "## Modüller", "", "| Modül | Durum | Ayrıntı |", "|---|---|---|");
  for (const m of r.modules) lines.push(`| ${md(m.title)} | ${STATUS_ICON[m.status]} | ${md(m.detail)} |`);
  lines.push("", "## Kontroller", "", "| Kontrol | Durum | Süre (ms) | Ayrıntı |", "|---|---|---|---|");
  for (const k of r.checks) lines.push(`| ${md(k.label)} | ${STATUS_ICON[k.status]} | ${k.ms} | ${md(k.detail)} |`);
  lines.push("", `Durumlar: ${(Object.keys(STATUS_ICON) as (keyof typeof STATUS_ICON)[]).map((s) => `${STATUS_ICON[s]} ${STATUS_TEXT[s]}`).join(" · ")}`, "");
  return lines.join("\n");
}

export function toCsv(r: Report): string {
  const rows: (string | number)[][] = [["Tür", "Kimlik", "Ad", "Durum", "Süre (ms)", "Ayrıntı"]];
  for (const m of r.modules) rows.push(["Modül", m.id, m.title, m.status, "", m.detail]);
  for (const k of r.checks) rows.push(["Kontrol", k.id, k.label, k.status, k.ms, k.detail]);
  // BOM + noktalı virgül: Türkçe Excel doğrudan doğru açar.
  return "﻿" + rows.map((row) => row.map(csvCell).join(";")).join("\n");
}
