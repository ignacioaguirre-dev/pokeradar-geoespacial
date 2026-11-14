import { fireEvent } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import { CreatureRoute } from "./creature-route";

const fake = vi.hoisted(() => ({ search: "", loads: 0, failures: 0 }));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(fake.search) }));

// Stands in for the panel's chunk: each evaluation is a download, and a throw is a failed one
vi.mock("./detail-panel", () => {
  fake.loads += 1;
  if (fake.failures > 0) {
    fake.failures -= 1;
    throw new Error("ChunkLoadError");
  }
  return { DetailPanel: ({ id }: { id: number | null }) => <p>Panel {id}</p> };
});

async function flush() {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

function renderRoute() {
  render(<CreatureRoute wide={false} fallbackFocus={() => null} />);
}

describe("CreatureRoute", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.search = "";
    fake.failures = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("downloads the panel only when a creature opens", async () => {
    renderRoute();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fake.loads).toBe(0);
  });

  it("shows an error with retry when the panel cannot download, and retry asks for it again", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.search = "creature=25";
    fake.failures = 1;
    renderRoute();
    await flush();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar la criatura.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await flush();
    expect(fake.loads).toBe(2);
    expect(screen.getByText("Panel 25")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
