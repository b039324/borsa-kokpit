import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import def from "./seans-durumu.module";

const Comp = def.component;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("seans durumu modülü", () => {
  it("modül tanımı geçerli", () => {
    expect(def.id).toBe("seans-durumu");
    expect(def.scope).toBe("global");
  });

  it("sürekli işlemde aşama, geri sayım ve yenileme durumunu gösterir", () => {
    vi.setSystemTime(new Date("2026-11-16T07:30:00Z")); // 10:30 TR
    render(<Comp symbol={null} />);
    expect(screen.getByText("Sürekli işlem")).toBeInTheDocument();
    expect(screen.getByText("Kapanış öncesi", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("7 sa 30 dk 00 sn")).toBeInTheDocument();
    expect(screen.getByText("Veri yenileme: açık (15 sn)")).toBeInTheDocument();
  });

  it("her saniye geri sayar", () => {
    vi.setSystemTime(new Date("2026-11-16T07:30:00Z"));
    render(<Comp symbol={null} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("7 sa 29 dk 59 sn")).toBeInTheDocument();
  });

  it("hafta sonu kapalı, yenileme durur, açılışa süre gösterir", () => {
    vi.setSystemTime(new Date("2026-11-21T09:00:00Z")); // Cumartesi 12:00 TR
    render(<Comp symbol={null} />);
    expect(screen.getByText("Seans kapalı")).toBeInTheDocument();
    expect(screen.getByText("45 sa 40 dk 00 sn")).toBeInTheDocument();
    expect(screen.getByText("Veri yenileme: kapalı")).toBeInTheDocument();
  });

  it("resmî tatil/yarım gün uyarısını gösterir", () => {
    vi.setSystemTime(new Date("2026-11-16T07:30:00Z"));
    render(<Comp symbol={null} />);
    expect(screen.getByText(/resmî tatil/i)).toBeInTheDocument();
  });
});
