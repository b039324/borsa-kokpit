import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAlarms, saveAlarms, type Alarm, type QuoteItem } from "./api";
import { evaluateAlarms } from "./alarm/logic";
import { nf } from "./format";
import { useQuotes } from "./hooks/useQuotes";
import { getToken } from "./storage";

export const MAX_ALARMS = 30; // Worker ile aynı

export type AlarmStatus = "loading" | "ready" | "error";

interface Toast {
  key: string;
  alarm: Alarm;
  price: number;
}

interface AlarmsValue {
  alarms: Alarm[];
  status: AlarmStatus;
  quotes: Record<string, QuoteItem>;
  saveFailed: boolean;
  full: boolean;
  add: (symbol: string, dir: Alarm["dir"], price: number) => boolean;
  remove: (id: string) => void;
}

const EMPTY: AlarmsValue = {
  alarms: [], status: "ready", quotes: {}, saveFailed: false, full: false, add: () => false, remove: () => {},
};
const AlarmsContext = createContext<AlarmsValue>(EMPTY);

function notify(a: Alarm, price: number) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(`${a.symbol} alarmı`, { body: `${nf(a.price)} hedefine ulaştı (güncel ${nf(price)})` });
    }
  } catch {
    /* bildirim desteklenmiyor → ekran içi bildirim yeterli */
  }
}

const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Alarmlar sunucuda saklanır (her cihazda aynı). Kontrol YALNIZ sayfa açıkken yapılır:
// aktif alarmların hisseleri useQuotes ile çekilir (seansta 15 sn'de bir).
// Güvenlik kuralı (favoriler gibi): yükleme başarısızsa hiçbir şey kaydedilmez.
export function AlarmsProvider({ children }: { children: ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [status, setStatus] = useState<AlarmStatus>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ref = useRef<Alarm[]>([]);
  const statusRef = useRef<AlarmStatus>("loading");
  const saving = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    getAlarms(getToken() ?? "").then(
      (list) => {
        if (!alive) return;
        ref.current = list;
        statusRef.current = "ready";
        setAlarms(list);
        setStatus("ready");
      },
      () => {
        if (!alive) return;
        statusRef.current = "error";
        setStatus("error");
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const flush = useCallback(async () => {
    if (saving.current) {
      dirty.current = true;
      return;
    }
    saving.current = true;
    try {
      do {
        dirty.current = false;
        try {
          await saveAlarms(getToken() ?? "", ref.current);
          setSaveFailed(false);
        } catch {
          setSaveFailed(true);
          dirty.current = false;
        }
      } while (dirty.current);
    } finally {
      saving.current = false;
    }
  }, []);

  const active = useMemo(
    () => Array.from(new Set(alarms.filter((a) => a.triggeredAt === null).map((a) => a.symbol))),
    [alarms],
  );
  const qs = useQuotes(active);

  // Yeni fiyatlar geldikçe aktif alarmları kontrol et.
  useEffect(() => {
    if (statusRef.current !== "ready") return;
    const r = evaluateAlarms(ref.current, qs.quotes, Date.now());
    if (!r.changed) return;
    ref.current = r.alarms;
    setAlarms(r.alarms);
    setToasts((t) => [...t, ...r.fired.map((f) => ({ key: `${f.alarm.id}-${f.alarm.triggeredAt}`, alarm: f.alarm, price: f.price }))]);
    r.fired.forEach((f) => notify(f.alarm, f.price));
    void flush();
  }, [qs.quotes, flush]);

  const add = useCallback(
    (symbol: string, dir: Alarm["dir"], price: number) => {
      if (statusRef.current !== "ready" || ref.current.length >= MAX_ALARMS) return false;
      const next = [...ref.current, { id: newId(), symbol, dir, price, createdAt: Date.now(), triggeredAt: null }];
      ref.current = next;
      setAlarms(next);
      void flush();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
      } catch {
        /* yok say */
      }
      return true;
    },
    [flush],
  );

  const remove = useCallback(
    (id: string) => {
      if (statusRef.current !== "ready") return;
      const next = ref.current.filter((a) => a.id !== id);
      if (next.length === ref.current.length) return;
      ref.current = next;
      setAlarms(next);
      void flush();
    },
    [flush],
  );

  const value = useMemo<AlarmsValue>(
    () => ({ alarms, status, quotes: qs.quotes, saveFailed, full: alarms.length >= MAX_ALARMS, add, remove }),
    [alarms, status, qs.quotes, saveFailed, add, remove],
  );

  return (
    <AlarmsContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="alarm-toasts">
          {toasts.map((t) => (
            <div key={t.key} className="alarm-toast" role="alert" data-testid="alarm-toast">
              <span>
                <strong>{t.alarm.symbol}</strong> {nf(t.alarm.price)} hedefine ulaştı (güncel {nf(t.price)})
              </span>
              <button type="button" aria-label="Bildirimi kapat" onClick={() => setToasts((x) => x.filter((y) => y.key !== t.key))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </AlarmsContext.Provider>
  );
}

export function useAlarms(): AlarmsValue {
  return useContext(AlarmsContext);
}
