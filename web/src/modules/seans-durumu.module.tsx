import { useEffect, useState } from "react";
import { formatCountdown, sessionInfo } from "../market/sessionInfo";
import type { ModuleDef } from "./types";

function SeansDurumu() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const s = sessionInfo(now);
  const tone = s.phase === "surekli" ? "up" : s.phase === "kapali" ? "flat" : "warn";

  return (
    <div className="session-card">
      <div className={`session-phase ${tone}`}>{s.label}</div>
      <div className="muted">{s.nextLabel} için kalan süre</div>
      <div className="session-count">{formatCountdown(s.secondsLeft)}</div>
      <p className="muted price-foot">Veri yenileme: {s.dataRefreshActive ? "açık (15 sn)" : "kapalı"}</p>
      <p className="muted price-foot">Resmî tatil ve yarım günler dikkate alınmaz.</p>
    </div>
  );
}

const def: ModuleDef = {
  id: "seans-durumu",
  title: "Seans durumu",
  scope: "global",
  defaultSize: { w: 14, h: 9 },
  minSize: { w: 10, h: 7 },
  order: 6,
  component: SeansDurumu,
};

export default def;
