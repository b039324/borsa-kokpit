import { describe, expect, it } from "vitest";
import manifestRaw from "../public/manifest.webmanifest?raw";
import swRaw from "../public/sw.js?raw";
import htmlRaw from "../index.html?raw";

// public/ altındaki PNG dosyaları (yol sonu adıyla)
const pngs = new Set(Object.keys(import.meta.glob("../public/*.png", { query: "?url" })).map((p) => p.split("/").pop()));

describe("kurulabilir uygulama dosyaları (PWA)", () => {
  const manifest = JSON.parse(manifestRaw);

  it("manifest: ad, bağımsız pencere, göreli başlangıç (GitHub Pages alt yolu için)", () => {
    expect(manifest.name).toBe("Borsa Kokpit");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("tr");
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.start_url.startsWith("/")).toBe(false);
  });

  it("manifest: 192 ve 512 PNG simge var, dosyalar gerçekten mevcut; maskable simge de var", () => {
    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const i of manifest.icons) {
      expect(i.type).toBe("image/png");
      expect(i.src.startsWith("/")).toBe(false);
      expect(pngs.has(i.src)).toBe(true);
    }
    expect(manifest.icons.some((i: any) => String(i.purpose).includes("maskable"))).toBe(true);
  });

  it("index.html manifesti BASE_URL ile bağlar ve tema rengini verir", () => {
    const html = htmlRaw;
    expect(html).toContain('rel="manifest" href="%BASE_URL%manifest.webmanifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it("servis çalışanı var, önbelleğe yanıt vermez (eski sürümde takılmayı önler)", () => {
    const sw = swRaw;
    expect(sw).toContain("addEventListener(\"fetch\"");
    expect(sw).not.toContain("respondWith");
    expect(sw).not.toContain("caches.");
  });
});
