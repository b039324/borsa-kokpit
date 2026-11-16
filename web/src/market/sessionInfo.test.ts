import { describe, expect, it } from "vitest";
import { formatCountdown, sessionInfo } from "./sessionInfo";

// Türkiye saati = UTC+3. 16 Kasım 2026 Pazartesi.
const at = (iso: string) => new Date(iso);

describe("sessionInfo", () => {
  it("10:30 → sürekli işlem, 18:00'e 27000 sn", () => {
    const s = sessionInfo(at("2026-11-16T07:30:00Z"));
    expect(s.phase).toBe("surekli");
    expect(s.label).toBe("Sürekli işlem");
    expect(s.nextLabel).toBe("Kapanış öncesi");
    expect(s.secondsLeft).toBe(27000);
    expect(s.dataRefreshActive).toBe(true);
  });

  it("09:40 → açılış emir toplama, 15 dk sonra fiyat belirleme", () => {
    const s = sessionInfo(at("2026-11-16T06:40:00Z"));
    expect(s.phase).toBe("acilis-emir");
    expect(s.nextLabel).toBe("Açılış fiyat belirleme");
    expect(s.secondsLeft).toBe(900);
  });

  it("09:56 → açılış fiyat belirleme, 10:00'a 240 sn", () => {
    const s = sessionInfo(at("2026-11-16T06:56:00Z"));
    expect(s.phase).toBe("acilis-fiyat");
    expect(s.nextLabel).toBe("Sürekli işlem");
    expect(s.secondsLeft).toBe(240);
  });

  it("09:00 → kapalı, açılışa 2400 sn, veri yenileme kapalı", () => {
    const s = sessionInfo(at("2026-11-16T06:00:00Z"));
    expect(s.phase).toBe("kapali");
    expect(s.nextLabel).toBe("Açılış emir toplama");
    expect(s.secondsLeft).toBe(2400);
    expect(s.dataRefreshActive).toBe(false);
  });

  it("18:00:30 → kapanış öncesi, 18:01'e 30 sn", () => {
    const s = sessionInfo(at("2026-11-16T15:00:30Z"));
    expect(s.phase).toBe("kapanis-marj");
    expect(s.nextLabel).toBe("Kapanış emir toplama");
    expect(s.secondsLeft).toBe(30);
  });

  it("18:03 → kapanış emir toplama", () => {
    expect(sessionInfo(at("2026-11-16T15:03:00Z")).phase).toBe("kapanis-emir");
  });

  it("18:06 → kapanış fiyat belirleme, 18:08'e 120 sn", () => {
    const s = sessionInfo(at("2026-11-16T15:06:00Z"));
    expect(s.phase).toBe("kapanis-fiyat");
    expect(s.secondsLeft).toBe(120);
  });

  it("18:09 → kapanış fiyatından işlem; 18:10'da kapalı", () => {
    expect(sessionInfo(at("2026-11-16T15:09:00Z")).phase).toBe("kapanis-islem");
    expect(sessionInfo(at("2026-11-16T15:10:00Z")).phase).toBe("kapali");
  });

  it("18:20 → kapalı ama veri yenileme hâlâ açık (18:30'a kadar)", () => {
    const s = sessionInfo(at("2026-11-16T15:20:00Z"));
    expect(s.phase).toBe("kapali");
    expect(s.dataRefreshActive).toBe(true);
  });

  it("Pazartesi 18:30 → sonraki açılış Salı 09:40 (54600 sn)", () => {
    const s = sessionInfo(at("2026-11-16T15:30:00Z"));
    expect(s.nextLabel).toBe("Açılış emir toplama");
    expect(s.secondsLeft).toBe(54600);
  });

  it("Cuma 19:00 → sonraki açılış Pazartesi 09:40 (225600 sn)", () => {
    const s = sessionInfo(at("2026-11-20T16:00:00Z"));
    expect(s.phase).toBe("kapali");
    expect(s.secondsLeft).toBe(225600);
  });

  it("Cumartesi 12:00 → Pazartesi 09:40 (164400 sn)", () => {
    const s = sessionInfo(at("2026-11-21T09:00:00Z"));
    expect(s.phase).toBe("kapali");
    expect(s.secondsLeft).toBe(164400);
  });

  it("Pazar → Pazartesi 09:40", () => {
    const s = sessionInfo(at("2026-11-22T09:00:00Z"));
    expect(s.phase).toBe("kapali");
    expect(s.secondsLeft).toBe(78000);
  });
});

describe("formatCountdown", () => {
  it("saniye", () => expect(formatCountdown(45)).toBe("45 sn"));
  it("dakika + saniye", () => expect(formatCountdown(125)).toBe("2 dk 05 sn"));
  it("saat + dakika + saniye", () => expect(formatCountdown(27000)).toBe("7 sa 30 dk 00 sn"));
  it("günü saate katar", () => expect(formatCountdown(225600)).toBe("62 sa 40 dk 00 sn"));
  it("negatifte 0", () => expect(formatCountdown(-5)).toBe("0 sn"));
});
