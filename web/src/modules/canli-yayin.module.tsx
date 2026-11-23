import { useEffect, useState } from "react";
import type { ModuleDef } from "./types";

export const STORAGE_KEY = "kokpit_canli_yayin";

// embed: iframe adresi, open: "YouTube'da aç" adresi.
// Bloomberg HT kanal kimliğiyle (kanalın o anki canlı yayınına bağlanır), NTV sabit canlı yayın videosuyla. NTV yayın adresini değiştirirse yalnız aşağıdaki video kimliği güncellenir.
export const CHANNELS = [
  {
    name: "Bloomberg HT",
    embed: "https://www.youtube.com/embed/live_stream?channel=UCApLxl6oYQafxvykuoC2uxQ",
    open: "https://www.youtube.com/channel/UCApLxl6oYQafxvykuoC2uxQ/live",
  },
  {
    name: "NTV",
    embed: "https://www.youtube.com/embed/pqq5c6k70kk",
    open: "https://www.youtube.com/watch?v=pqq5c6k70kk",
  },
] as const;

function loadName(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && CHANNELS.some((c) => c.name === v)) return v;
  } catch { /* depolama kapalı olabilir */ }
  return CHANNELS[0].name;
}

function CanliYayin() {
  const [name, setName] = useState<string>(loadName);
  const ch = CHANNELS.find((c) => c.name === name) ?? CHANNELS[0];

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, name); } catch { /* yok say */ }
  }, [name]);

  return (
    <div className="chart-wrap live-wrap">
      <div className="chart-bar">
        <div role="tablist" aria-label="Kanal">
          {CHANNELS.map((c) => (
            <button key={c.name} role="tab" type="button" aria-selected={c.name === ch.name} onClick={() => setName(c.name)}>
              {c.name}
            </button>
          ))}
        </div>
        <a
          className="live-open"
          href={ch.open}
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube'da aç
        </a>
      </div>
      <div className="chart-area live-area">
        <iframe
          key={ch.name}
          title={`${ch.name} canlı yayın`}
          src={ch.embed}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="muted live-note">Yayın görünmüyorsa kanal şu an yayında değildir ya da gömmeye kapalıdır; "YouTube'da aç" ile izleyebilirsin.</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "canli-yayin",
  title: "Canlı yayın (Bloomberg HT / NTV)",
  scope: "global",
  defaultSize: { w: 36, h: 26 },
  minSize: { w: 20, h: 16 },
  order: 8,
  component: CanliYayin,
};

export default def;
