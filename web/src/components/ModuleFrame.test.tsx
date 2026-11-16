import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModuleFrame } from "./ModuleFrame";
import type { ModuleDef, ModuleProps } from "../modules/types";

function Show({ symbol }: ModuleProps) {
  return <div data-testid="icerik">içerik:{symbol ?? "yok"}</div>;
}

function Boom(): never {
  throw new Error("patladı");
}

function def(over: Partial<ModuleDef> = {}): ModuleDef {
  return {
    id: "test",
    title: "Deneme",
    scope: "stock",
    defaultSize: { w: 10, h: 10 },
    component: Show,
    ...over,
  };
}

describe("ModuleFrame", () => {
  it("başlığı gösterir", () => {
    render(<ModuleFrame def={def()} symbol="THYAO" onClose={() => {}} />);
    expect(screen.getByText("Deneme")).toBeInTheDocument();
  });

  it("hisseye bağlı modül, hisse yokken içeriği çizmez ve yönlendirir", () => {
    render(<ModuleFrame def={def()} symbol={null} onClose={() => {}} />);
    expect(screen.getByText("Bir hisse seç.")).toBeInTheDocument();
    expect(screen.queryByTestId("icerik")).toBeNull();
  });

  it("hisseye bağlı modül, hisse varken içeriğe sembolü verir", () => {
    render(<ModuleFrame def={def()} symbol="ASELS" onClose={() => {}} />);
    expect(screen.getByTestId("icerik")).toHaveTextContent("içerik:ASELS");
  });

  it("bağımsız modül hisse olmadan da çizilir", () => {
    render(<ModuleFrame def={def({ scope: "global" })} symbol={null} onClose={() => {}} />);
    expect(screen.getByTestId("icerik")).toHaveTextContent("içerik:yok");
  });

  it("kapat düğmesi modül id'siyle çağrılır", async () => {
    const onClose = vi.fn();
    render(<ModuleFrame def={def({ id: "xyz" })} symbol="THYAO" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Kapat: Deneme" }));
    expect(onClose).toHaveBeenCalledWith("xyz");
  });

  it("modül hata verirse yalnız o modül düşer, mesaj gösterilir", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <ModuleFrame def={def({ id: "kotu", component: Boom })} symbol="THYAO" onClose={() => {}} />
        <ModuleFrame def={def({ id: "iyi", title: "Sağlam" })} symbol="THYAO" onClose={() => {}} />
      </div>,
    );
    expect(screen.getByText("Bu modül hata verdi.")).toBeInTheDocument();
    expect(screen.getByText("Sağlam")).toBeInTheDocument();
    expect(screen.getByTestId("icerik")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("hatalı modül hisse değişince yeniden denenir", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    function Flaky({ symbol }: ModuleProps) {
      if (fail) throw new Error("x");
      return <div data-testid="icerik">tamam:{symbol}</div>;
    }
    const d = def({ component: Flaky });
    const { rerender } = render(<ModuleFrame def={d} symbol="A" onClose={() => {}} />);
    expect(screen.getByText("Bu modül hata verdi.")).toBeInTheDocument();
    fail = false;
    rerender(<ModuleFrame def={d} symbol="B" onClose={() => {}} />);
    expect(screen.getByTestId("icerik")).toHaveTextContent("tamam:B");
    spy.mockRestore();
  });
});
