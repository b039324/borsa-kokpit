import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AuthProvider } from "../auth";
import { SelectionProvider } from "../selection";
import { LayoutProvider } from "../layout/LayoutProvider";
import { TOKEN_KEY } from "./helpers";

// Oturum açık varsayılır; kaydetme/yeniden deneme süreleri testte kısaltılır.
export function renderWithApp(
  ui: ReactElement,
  opts: { saveDelayMs?: number; retryDelayMs?: number } = {},
) {
  localStorage.setItem(TOKEN_KEY, "tok");
  return render(
    <AuthProvider>
      <SelectionProvider>
        <LayoutProvider saveDelayMs={opts.saveDelayMs ?? 10} retryDelayMs={opts.retryDelayMs ?? 20}>
          {ui}
        </LayoutProvider>
      </SelectionProvider>
    </AuthProvider>,
  );
}
