import { describe, expect, it } from "vitest";
import { toCsv, toMarkdown } from "./report";
import type { Report } from "./types";

const rep: Report = {
  startedAt: "2026-11-20T16:30:00.000Z",
  sample: "AKBNK",
  marketOpen: false,
  checks: [
    { id: "market", label: "Piyasa özeti", status: "ok", detail: "8/8 fiyat", ms: 120 },
    { id: "financials-bank", label: "Finansal tablo (banka)", status: "warn", detail: 'gelir yok; "banka" olabilir, satır\nsonu', ms: 300 },
  ],
  modules: [
    { id: "endeks-ozet", title: "Endeks özeti", checks: ["market"], status: "ok", detail: "8/8 fiyat" },
    { id: "finansal-tablo", title: "Finansal tablo", checks: ["financials-bank"], status: "warn", detail: "gelir yok" },
  ],
  counts: { ok: 1, warn: 1, fail: 0, manual: 0 },
};

describe("toMarkdown", () => {
  const md = toMarkdown(rep);
  it("başlık, örnek hisse, özet sayıları ve piyasa notu içerir", () => {
    expect(md).toContain("# Sistem testi raporu");
    expect(md).toContain("AKBNK");
    expect(md).toMatch(/1 tamam.*1 uyarı.*0 hata/s);
    expect(md).toMatch(/piyasa kapalı/i);
  });
  it("her modül için bir satır ve durum simgesi var", () => {
    expect(md).toContain("| Endeks özeti | ✓ |");
    expect(md).toContain("| Finansal tablo | ⚠ |");
  });
  it("tablo hücresindeki | ve satır sonu bozulmaz", () => {
    const r2 = toMarkdown({ ...rep, checks: [{ ...rep.checks[0], detail: "a|b\nc" }] });
    expect(r2).toContain("a\\|b c");
  });
});

describe("toCsv", () => {
  const csv = toCsv(rep);
  it("Excel için BOM ve noktalı virgül ayracı ile başlar", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\n")[0]).toBe("﻿Tür;Kimlik;Ad;Durum;Süre (ms);Ayrıntı");
  });
  it("hem modül hem altyapı/kontrol satırlarını yazar", () => {
    expect(csv).toContain("Modül;endeks-ozet;Endeks özeti;ok;;8/8 fiyat");
    expect(csv).toContain("Kontrol;market;Piyasa özeti;ok;120;8/8 fiyat");
  });
  it("tırnak, ayraç ve satır sonunu kaçırır", () => {
    expect(csv).toContain('"gelir yok; ""banka"" olabilir, satır sonu"');
  });
});
