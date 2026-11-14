import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FenceDetection } from "@/features/sweep/types";
import { render, screen, within } from "@/testing/render";
import { SweepReading } from "./sweep-reading";

const READY: FenceDetection = {
  status: "ready",
  weakSignals: 7,
  traced: [
    { id: 25, name: "Pikachu", point: [-57.2, -28.8] },
    { id: 7, name: "Squirtle", point: [-56.5, -29.5] },
  ],
};

function renderReading(detection: FenceDetection, handlers: Partial<Parameters<typeof SweepReading>[0]> = {}) {
  const props = { onOpen: vi.fn(), onIntent: vi.fn(), onRetry: vi.fn(), ...handlers };
  render(<SweepReading detection={detection} fenceName="Esteros del Iberá" {...props} />);
  return props;
}

describe("SweepReading", () => {
  it("before a fence is chosen, says what to do", () => {
    renderReading({ status: "idle" });
    expect(screen.getByText("Elegí una cerca para barrerla.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("announces how many creatures it detected and the weak signals left", () => {
    renderReading(READY);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Esteros del Iberá: 2 criaturas detectadas y 7 señales débiles. Achicá la cerca para resolverlas.",
    );
  });

  it("leaves the weak signals out when there are none", () => {
    renderReading({ ...READY, weakSignals: 0 });
    expect(screen.getByRole("status")).toHaveTextContent(/^Esteros del Iberá: 2 criaturas detectadas\.$/);
  });

  it("uses the singular for one", () => {
    renderReading({ status: "ready", weakSignals: 1, traced: [READY.traced[0]] });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Esteros del Iberá: 1 criatura detectada y 1 señal débil. Achicá la cerca para resolverla.",
    );
  });

  it("an empty fence suggests trying another", () => {
    renderReading({ status: "ready", traced: [], weakSignals: 0 });
    expect(screen.getByRole("status")).toHaveTextContent("Esteros del Iberá: ninguna criatura detectada. Probá con otra cerca.");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says it is looking while the sightings arrive", () => {
    renderReading({ status: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent("Buscando criaturas…");
  });

  it("when the creatures could not load, says so and offers a retry", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderReading({ status: "unavailable" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar las criaturas.");
    expect(alert).toHaveTextContent("Probá de nuevo en unos segundos.");
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  // The same creatures as the markers, in the same order, for the keyboard and screen readers
  it("lists the traced creatures as buttons that open their detail", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderReading(READY);
    const list = screen.getByRole("list", { name: "Criaturas detectadas en Esteros del Iberá" });
    const buttons = within(list).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Ver Pikachu", "Ver Squirtle"]);
    expect(buttons[0]).toHaveTextContent("Pikachu");
    await user.click(buttons[1]);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("announces intent on hover and focus, so the detail can load ahead", async () => {
    const user = userEvent.setup();
    const { onIntent } = renderReading(READY);
    await user.hover(screen.getByRole("button", { name: "Ver Pikachu" }));
    expect(onIntent).toHaveBeenCalledWith(25);
    await user.tab();
    expect(onIntent).toHaveBeenCalledWith(25);
  });
});
