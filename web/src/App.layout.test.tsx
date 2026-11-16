import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { apiMock, TOKEN_KEY } from "./test/helpers";

function open() {
  localStorage.setItem(TOKEN_KEY, "tok");
  return render(<App />);
}

describe("ana ekran: modül ekle/çıkar", () => {
  it("düğme çekmeceyi açar, modül eklenir, Esc çekmeceyi kapatır, modül kalır", async () => {
    const m = apiMock();
    open();
    const btn = await screen.findByRole("button", { name: "Modül ekle/çıkar" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Modül ekle/çıkar" })).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("switch", { name: "Örnek: saat" }));
    expect(screen.getByLabelText("Örnek: saat", { selector: "section" })).toBeInTheDocument();
    await waitFor(() => expect(m.puts).toHaveLength(1));

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Örnek: saat", { selector: "section" })).toBeInTheDocument();
  });

  it("düğme ikinci tıkta çekmeceyi kapatır", async () => {
    apiMock();
    open();
    const btn = await screen.findByRole("button", { name: "Modül ekle/çıkar" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("kayıt reddedilirse üst barda uyarı çıkar", async () => {
    apiMock({ putStatuses: [400] });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Modül ekle/çıkar" }));
    await userEvent.click(await screen.findByRole("switch", { name: "Örnek: saat" }));
    expect(await screen.findByText("Düzen kaydedilemedi")).toBeInTheDocument();
  });

  it("düzen isteği 401 dönerse giriş ekranına döner", async () => {
    apiMock({ layoutGetStatus: 401 });
    open();
    expect(await screen.findByLabelText("Şifre")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
