import { useEffect, useState } from "react";
import type { ModuleDef } from "./types";

export const STORAGE_KEY = "kokpit_canli_yayin";

// YouTube kanal kimlikleri (UC…). Canlı yayın, kanalın o an yayında olan videosuna bağlanır.
export const CHANNELS = [
  { name: "Bloomberg HT", id: "UCApLxl6oYQafxvykuoC2uxQ" },
  { name: "Ekotürk", id: "UC0RSzZC8Rmu6tVsL93I8s9A" },
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
            <button key={c.id} role="tab" type="button" aria-selected={c.name === ch.name} onClick={() => setName(c.name)}>
              {c.name}
            </button>
          ))}
        </div>
        <a
          className="live-open"
          href={`https://www.youtube.com/channel/${ch.id}/live`}
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube'da aç
        </a>
      </div>
      <div className="chart-area live-area">
        <iframe
          key={ch.id}
          title={`${ch.name} canlı yayın`}
          src={`https://www.youtube.com/embed/live_stream?channel=${ch.id}`}
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
  title: "Canlı yayın (Bloomberg HT / Ekotürk)",
  scope: "global",
  defaultSize: { w: 36, h: 26 },
  minSize: { w: 20, h: 16 },
  order: 8,
  component: CanliYayin,
};

export default def;
