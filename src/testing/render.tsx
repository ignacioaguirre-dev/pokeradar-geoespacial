import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import messages from "../../messages/es-AR.json";

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="es-AR" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

// Same API as Testing Library's render, with the real es-AR catalog available
export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export { screen, within, waitFor } from "@testing-library/react";
