import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SystemTest, type RunFn } from "./SystemTest";
import { TOKEN_KEY, apiMock } from "../test/helpers";
import { renderWithApp } from "../test/render";
import type { Report } from "../diagnostics/types";

const report: Report = {
  startedAt: "2026-11-20T16:30:00.000Z",
  sample: "AKBNK",
  marketOpen: true,
  checks: [{ id: "market", label: "Piyasa özeti", status: "ok", detail: "8/8 fiyat", ms: 10 }],
  modules: [
    { id: "a", title: "Tamam modül", checks: ["market"], status: "ok", detail: "iyi" },
    { id: "b", title: "Hatalı modül", checks: ["market"], status: "fail", detail: "veri yok" },
    { id: "c", title: "Uyarılı modül", checks: ["market"], status: "warn", detail: "eksik" },
  ],
  counts: { ok: 1, warn: 1, fail: 1, manual: 0 },
};

const readBlob = (b: Blob) =>
  new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(b); });

beforeEach(() => {
  apiMock(); // AuthProvider oturum doğrulaması gerçek ağa gitmesin (yoksa token silinebilir)
  localStorage.setItem(TOKEN_KEY, "tok");
});
afterEach(() => vi.restoreAllMocks());

function open(run: RunFn) {
  renderWithApp(<SystemTest run={run} />);
  return userEvent.click(screen.getByRole("button", { name: "Sistem testi" }));
}

describe("SystemTest", () => {
  it("düğmeye basınca ortada pencere açar ve 'taranıyor' ile ilerlemeyi gösterir", async () => {
    let resolve!: (r: Report) => void;
    const run: RunFn = ({ onProgress }) => new Promise((res) => { resolve = res; onProgress(2, 5); });
    await open(run);
    const dlg = screen.getByRole("dialog", { name: "Sistem testi" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(within(dlg).getByText(/Modüller taranıyor/)).toBeInTheDocument();
    expect(within(dlg).getByText("2/5")).toBeInTheDocument();
    expect(within(dlg).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    await act(async () => resolve(report));
  });

  it("bitince özet ve modül satırları gelir; en kötü durum üstte", async () => {
    await open(async () => report);
    const dlg = await screen.findByRole("dialog", { name: "Sistem testi" });
    await within(dlg).findByText(/1 tamam/);
    expect(dlg).toHaveTextContent(/1 uyarı/);
    expect(dlg).toHaveTextContent(/1 hata/);
    const rows = within(dlg).getAllByTestId("st-row").map((r) => r.textContent ?? "");
    expect(rows[0]).toContain("Hatalı modül");
    expect(rows[1]).toContain("Uyarılı modül");
    expect(rows[2]).toContain("Tamam modül");
    expect(within(dlg).queryByText(/Modüller taranıyor/)).toBeNull();
  });

  it("seçili hisseyi örnek olarak runner'a verir (yoksa AKBNK)", async () => {
    const run = vi.fn<RunFn>(async () => report);
    await open(run);
    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(run.mock.calls[0][0].sample).toBe("AKBNK");
    expect(run.mock.calls[0][0].token).toBe("tok");
  });

  it("Escape pencereyi kapatır ve çalışan taramayı iptal eder", async () => {
    let signal!: AbortSignal;
    await open(({ signal: s }) => { signal = s; return new Promise(() => {}); });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(signal.aborted).toBe(true);
  });

  it("Kapat düğmesi pencereyi kapatır", async () => {
    await open(async () => report);
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText(/1 tamam/);
    await userEvent.click(within(dlg).getByRole("button", { name: "Kapat" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Markdown indir: doğru adlı dosya üretir", async () => {
    const create = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    let name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    await open(async () => report);
    await userEvent.click(await screen.findByRole("button", { name: "Markdown indir" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(name).toBe("sistem-testi-2026-11-20.md");
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(await readBlob(blob)).toContain("# Sistem testi raporu");
  });

  it("CSV indir: .csv adı ve BOM'lu içerik", async () => {
    const create = vi.fn(() => "blob:y");
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    let name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    await open(async () => report);
    await userEvent.click(await screen.findByRole("button", { name: "CSV indir" }));
    expect(name).toBe("sistem-testi-2026-11-20.csv");
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(await readBlob(blob)).toContain("Tür;Kimlik;Ad;Durum");
  });

  it("Panoya kopyala: Markdown'ı panoya yazar ve 'Kopyalandı' der", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await open(async () => report);
    await userEvent.click(await screen.findByRole("button", { name: "Panoya kopyala" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Sistem testi raporu"));
    expect(await screen.findByText("Kopyalandı")).toBeInTheDocument();
  });

  it("tarama çökerse hata mesajı gösterir", async () => {
    await open(async () => { throw new Error("ağ yok"); });
    expect(await screen.findByRole("alert")).toHaveTextContent("ağ yok");
  });

  it("Yeniden tara taramayı baştan çalıştırır", async () => {
    const run = vi.fn<RunFn>(async () => report);
    await open(run);
    await userEvent.click(await screen.findByRole("button", { name: "Yeniden tara" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });
});
