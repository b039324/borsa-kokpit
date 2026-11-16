import { useEffect, useState } from "react";
import type { ModuleDef } from "./types";

// ÖRNEK modül (hisseden bağımsız). Gerçek modüller gelince bu dosya silinebilir.
function OrnekSaat() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="sample">
      <div className="sample-big">
        {now.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" })}
      </div>
      <div className="muted">İstanbul saati</div>
    </div>
  );
}

const def: ModuleDef = {
  id: "ornek-saat",
  title: "Örnek: saat",
  scope: "global",
  defaultSize: { w: 12, h: 7 },
  minSize: { w: 8, h: 5 },
  order: 901,
  component: OrnekSaat,
};

export default def;
