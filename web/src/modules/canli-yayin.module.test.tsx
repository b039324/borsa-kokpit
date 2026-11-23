import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import def, { CHANNELS } from "./canli-yayin.module";

const Comp = def.component;

beforeEach(() => localStorage.clear());

describe("canlı yayın modülü", () => {
  it("tanım: global kapsam", () => {
    expect(def.id).toBe("canli-yayin");
    expect(def.scope).toBe("global");
  });

  it("üç kanal sekmesi var: Bloomberg HT, NTV ve CNBC-e; varsayılan Bloomberg HT", () => {
    render(<Comp symbol={null} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Bloomberg HT", "NTV", "CNBC-e"]);
    expect(screen.getByRole("tab", { name: "Bloomberg HT" })).toHaveAttribute("aria-selected", "true");
  });

  it("seçili kanalın canlı yayınını YouTube'dan gömer", () => {
    render(<Comp symbol={null} />);
    const frame = screen.getByTitle("Bloomberg HT canlı yayın") as HTMLIFrameElement;
    expect(frame.src).toBe(CHANNELS[0].embed);
    expect(frame.src).toBe("https://www.youtube.com/embed/live_stream?channel=UCApLxl6oYQafxvykuoC2uxQ");
    expect(frame.getAttribute("allow")).toContain("fullscreen");
    expect(frame.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("NTV sekmesine geçince iframe NTV'ye döner (tek iframe)", async () => {
    render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "NTV" }));
    expect((screen.getByTitle("NTV canlı yayın") as HTMLIFrameElement).src).toBe("https://www.youtube.com/embed/pqq5c6k70kk");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("CNBC-e sekmesine geçince iframe CNBC-e'ye döner ve açma bağlantısı doğru olur", async () => {
    render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "CNBC-e" }));
    expect((screen.getByTitle("CNBC-e canlı yayın") as HTMLIFrameElement).src).toBe("https://www.youtube.com/embed/aZ3ycSbSYBA");
    expect(screen.getByRole("link", { name: /YouTube'da aç/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=aZ3ycSbSYBA");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("'YouTube'da aç' bağlantısı seçili kanalın canlı sayfasına gider", async () => {
    render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "NTV" }));
    const link = screen.getByRole("link", { name: /YouTube'da aç/ });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=pqq5c6k70kk");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("son seçilen kanal hatırlanır", async () => {
    const a = render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "NTV" }));
    a.unmount();
    render(<Comp symbol={null} />);
    expect(screen.getByRole("tab", { name: "NTV" })).toHaveAttribute("aria-selected", "true");
  });

  it("kaldırılan Ekotürk kanalı eski kayıtta kalsa bile varsayılana döner", () => {
    localStorage.setItem("kokpit_canli_yayin", "Ekotürk");
    render(<Comp symbol={null} />);
    expect(screen.getByRole("tab", { name: "Bloomberg HT" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Ekotürk" })).not.toBeInTheDocument();
  });

  it("bozuk kayıt varsayılana döner", () => {
    localStorage.setItem("kokpit_canli_yayin", "yok-boyle-kanal");
    render(<Comp symbol={null} />);
    expect(screen.getByRole("tab", { name: "Bloomberg HT" })).toHaveAttribute("aria-selected", "true");
  });

  it("her kanalın gömme ve açma adresi youtube.com üzerinde", () => {
    for (const c of CHANNELS) {
      expect(c.embed).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
      expect(c.open).toMatch(/^https:\/\/www\.youtube\.com\//);
    }
  });
});
