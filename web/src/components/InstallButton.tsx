import { useEffect, useState } from "react";

// Chromium tabanlı tarayıcıların (Chrome, Edge, Brave) kurulum olayı; standart tipte yok.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)")?.matches === true;

// Tarayıcı kurulum izni verdiğinde "Uygulamayı yükle" düğmesini gösterir; uygulama olarak açıksa hiç göstermez.
export function InstallButton() {
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // tarayıcının kendi çubuğu yerine kendi düğmemiz
      setEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!evt) return null;
  const install = async () => {
    await evt.prompt();
    await evt.userChoice.catch(() => undefined);
    setEvt(null); // olay tek kullanımlık
  };
  return (
    <button type="button" onClick={install} title="Bilgisayara uygulama olarak yükle">
      Uygulamayı yükle
    </button>
  );
}
