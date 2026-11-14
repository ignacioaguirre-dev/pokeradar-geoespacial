import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import { ConnectionStatus } from "./connection-status";

const OFFLINE = "Sin conexión.";
const OFFLINE_BODY = "Lo que ya está cargado sigue disponible; el resto vuelve cuando se recupere.";
const RECOVERED = "Conexión recuperada.";

let onLine = true;

function go(next: boolean) {
  onLine = next;
  act(() => {
    window.dispatchEvent(new Event(next ? "online" : "offline"));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function status() {
  return screen.getByRole("status");
}

describe("ConnectionStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    onLine = true;
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => onLine);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is an empty polite live region while online", () => {
    render(<ConnectionStatus />);
    expect(status()).toHaveAttribute("aria-live", "polite");
    expect(status()).toBeEmptyDOMElement();
  });

  it("ignores a cut shorter than a second", () => {
    render(<ConnectionStatus />);
    go(false);
    advance(999);
    go(true);
    advance(5_000);
    expect(status()).toBeEmptyDOMElement();
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
    expect(screen.queryByText(RECOVERED)).not.toBeInTheDocument();
  });

  it("tells the user after a second offline, without stealing focus", () => {
    render(<ConnectionStatus />);
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    go(false);
    advance(999);
    expect(status()).toBeEmptyDOMElement();
    advance(1);
    expect(status()).toHaveTextContent(OFFLINE);
    expect(status()).toHaveTextContent(OFFLINE_BODY);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).toBe(outside);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("says the connection is back at once and hides itself after three seconds", () => {
    render(<ConnectionStatus />);
    go(false);
    advance(1_000);
    go(true);
    expect(status()).toHaveTextContent(RECOVERED);
    expect(status()).not.toHaveTextContent(OFFLINE);
    advance(2_999);
    expect(status()).toHaveTextContent(RECOVERED);
    advance(1);
    expect(status()).toBeEmptyDOMElement();
  });

  it("shows the offline notice from the start when the page opens without a network", () => {
    onLine = false;
    render(<ConnectionStatus />);
    advance(1_000);
    expect(status()).toHaveTextContent(OFFLINE);
  });

  it("a new cut while the recovery shows goes back to offline", () => {
    render(<ConnectionStatus />);
    go(false);
    advance(1_000);
    go(true);
    go(false);
    advance(1_000);
    expect(status()).toHaveTextContent(OFFLINE);
    // The recovery's hide timer must not clear the new offline notice
    advance(5_000);
    expect(status()).toHaveTextContent(OFFLINE);
  });

  it("clears its timers when unmounted", () => {
    const { unmount } = render(<ConnectionStatus />);
    go(false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    const second = render(<ConnectionStatus />);
    go(false);
    advance(1_000);
    go(true);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
