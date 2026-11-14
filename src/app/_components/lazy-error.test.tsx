import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// The first dynamic import transforms the whole message catalog; under a full parallel run it outlasts the 1 s default
const LOAD = { timeout: 5000 };
const FALLBACK_BODY = "Volvé al mapa o recargá la página.";

// Fresh module each time: the loaded content is cached at module level
async function loadLazyError() {
  vi.resetModules();
  return (await import("./lazy-error")).LazyError;
}

afterEach(() => {
  vi.doUnmock("./error-content");
});

// No provider: the content brings its own translations, so it also works when the root layout is gone
describe("LazyError", () => {
  it("loads the app's error only when it renders, and retries", async () => {
    const LazyError = await loadLazyError();
    const onRetry = vi.fn();
    render(<LazyError onRetry={onRetry} />);
    const alert = (await screen.findByText("Probá de nuevo o volvé al mapa.", {}, LOAD)).closest("[role=alert]");
    expect(alert).toHaveTextContent("Algo salió mal.");
    expect(screen.queryByText(FALLBACK_BODY)).not.toBeInTheDocument();
    await userEvent.click(within(alert as HTMLElement).getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the loaded content right away the next time, without the fallback in between", async () => {
    const LazyError = await loadLazyError();
    const { unmount } = render(<LazyError onRetry={vi.fn()} />);
    await screen.findByText("Probá de nuevo o volvé al mapa.", {}, LOAD);
    unmount();
    render(<LazyError onRetry={vi.fn()} />);
    expect(screen.getByText("Probá de nuevo o volvé al mapa.")).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_BODY)).not.toBeInTheDocument();
  });

  it("falls back to a static message with a way out when the content can't be downloaded", async () => {
    vi.doMock("./error-content", () => {
      throw new Error("ChunkLoadError");
    });
    const LazyError = await loadLazyError();
    const reload = vi.fn();
    render(<LazyError onRetry={vi.fn()} reload={reload} />);
    // Give the rejected import time to settle; the fallback must still be there
    await new Promise((resolve) => setTimeout(resolve, 50));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(`Algo salió mal. ${FALLBACK_BODY}`);
    expect(within(alert).getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/");
    await userEvent.click(within(alert).getByRole("button", { name: "Recargar la página" }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
