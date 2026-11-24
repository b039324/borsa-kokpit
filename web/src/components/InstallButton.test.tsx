import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallButton } from "./InstallButton";

function promptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}
const fire = (e: Event) => act(() => void window.dispatchEvent(e));

afterEach(() => vi.unstubAllGlobals());

describe("InstallButton (kurulabilir uygulama)", () => {
  it("tarayıcı kurulum izni vermeden görünmez", () => {
    render(<InstallButton />);
    expect(screen.queryByRole("button", { name: "Uygulamayı yükle" })).not.toBeInTheDocument();
  });

  it("kurulum olayı gelince 'Uygulamayı yükle' düğmesi görünür ve tarayıcının kendi çubuğu bastırılır", () => {
    render(<InstallButton />);
    const e = promptEvent();
    fire(e);
    expect(screen.getByRole("button", { name: "Uygulamayı yükle" })).toBeInTheDocument();
    expect(e.defaultPrevented).toBe(true);
  });

  it("tıklayınca kurulum penceresini açar; seçimden sonra düğme kaybolur", async () => {
    render(<InstallButton />);
    const e = promptEvent("accepted");
    fire(e);
    await userEvent.click(screen.getByRole("button", { name: "Uygulamayı yükle" }));
    expect(e.prompt).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: "Uygulamayı yükle" })).not.toBeInTheDocument());
  });

  it("kullanıcı vazgeçerse de düğme kaybolur (olay tek kullanımlık)", async () => {
    render(<InstallButton />);
    fire(promptEvent("dismissed"));
    await userEvent.click(screen.getByRole("button", { name: "Uygulamayı yükle" }));
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: "Uygulamayı yükle" })).not.toBeInTheDocument());
  });

  it("uygulama kurulunca (appinstalled) düğme kaybolur", () => {
    render(<InstallButton />);
    fire(promptEvent());
    fire(new Event("appinstalled"));
    expect(screen.queryByRole("button", { name: "Uygulamayı yükle" })).not.toBeInTheDocument();
  });

  it("zaten uygulama penceresinde (standalone) açıksa hiç görünmez", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), media: q, addEventListener() {}, removeEventListener() {} }));
    render(<InstallButton />);
    fire(promptEvent());
    expect(screen.queryByRole("button", { name: "Uygulamayı yükle" })).not.toBeInTheDocument();
  });

  it("kaldırılınca dinleyicileri temizler", () => {
    const off = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<InstallButton />);
    unmount();
    const names = off.mock.calls.map((c) => c[0]);
    expect(names).toContain("beforeinstallprompt");
    expect(names).toContain("appinstalled");
    off.mockRestore();
  });
});
