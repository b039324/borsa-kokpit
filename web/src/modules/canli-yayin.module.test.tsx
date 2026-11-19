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

  it("iki kanal sekmesi var: Ekotürk ve Bloomberg HT; varsayılan Bloomberg HT", () => {
    render(<Comp symbol={null} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Bloomberg HT", "Ekotürk"]);
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

  it("Ekotürk sekmesine geçince iframe Ekotürk'e döner (tek iframe)", async () => {
    render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "Ekotürk" }));
    expect((screen.getByTitle("Ekotürk canlı yayın") as HTMLIFrameElement).src).toBe("https://www.youtube.com/embed/Sxkj7OuMj-Y");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("'YouTube'da aç' bağlantısı seçili kanalın canlı sayfasına gider", async () => {
    render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "Ekotürk" }));
    const link = screen.getByRole("link", { name: /YouTube'da aç/ });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=Sxkj7OuMj-Y");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("son seçilen kanal hatırlanır", async () => {
    const a = render(<Comp symbol={null} />);
    await userEvent.click(screen.getByRole("tab", { name: "Ekotürk" }));
    a.unmount();
    render(<Comp symbol={null} />);
    expect(screen.getByRole("tab", { name: "Ekotürk" })).toHaveAttribute("aria-selected", "true");
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
