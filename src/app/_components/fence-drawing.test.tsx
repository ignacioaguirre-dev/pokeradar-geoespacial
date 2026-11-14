import userEvent from "@testing-library/user-event";
import { act, createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { render, screen } from "@/testing/render";
import { FenceDrawing, type FenceDrawingHandle } from "./fence-drawing";

// A small square in Córdoba
const A: LngLat = [-64.5, -31.5];
const B: LngLat = [-64, -31.5];
const C: LngLat = [-64, -31];
const D: LngLat = [-64.5, -31];
const SANTIAGO_DE_CHILE: LngLat = [-70.65, -33.45];

// Twelve points around a circle in La Pampa: none of their edges cross
const CIRCLE: LngLat[] = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 2 * Math.PI;
  return [-65 + Math.cos(angle), -37 + Math.sin(angle)];
});

function Harness({
  initial = [],
  handle,
  onClose = vi.fn(),
  onCancel = vi.fn(),
  reticle = () => C,
}: {
  initial?: Ring;
  handle: React.RefObject<FenceDrawingHandle | null>;
  onClose?(ring: Ring): void;
  onCancel?(): void;
  reticle?(): LngLat | null;
}) {
  const [vertices, setVertices] = useState<Ring>(initial);
  return (
    <FenceDrawing
      ref={handle}
      vertices={vertices}
      onChange={setVertices}
      onClose={onClose}
      onCancel={onCancel}
      reticlePoint={reticle}
    />
  );
}

function setup(props: Partial<Parameters<typeof Harness>[0]> = {}) {
  const handle = createRef<FenceDrawingHandle>();
  const onClose = vi.fn();
  const onCancel = vi.fn();
  render(<Harness handle={handle} onClose={onClose} onCancel={onCancel} {...props} />);
  const add = (...points: LngLat[]) => {
    for (const point of points) act(() => handle.current?.add(point));
  };
  return { add, onClose, onCancel, user: userEvent.setup() };
}

const closeButton = () => screen.getByRole("button", { name: "Cerrar cerca" });

describe("FenceDrawing", () => {
  it("names the mode and how to use it", () => {
    setup();
    expect(screen.getByRole("region", { name: "Trazando cerca" })).toBeInTheDocument();
    expect(screen.getByText("tocá el mapa para sumar vértices")).toBeInTheDocument();
    expect(screen.getByText("0 de 12 vértices")).toBeInTheDocument();
  });

  it("takes the focus on «Sumar punto acá» when it opens", () => {
    setup();
    expect(screen.getByRole("button", { name: "Sumar punto acá" })).toHaveFocus();
  });

  it("«Sumar punto acá» adds the point under the reticle", async () => {
    const { user } = setup({ reticle: () => C });
    await user.click(screen.getByRole("button", { name: "Sumar punto acá" }));
    expect(screen.getByText("1 de 12 vértices")).toBeInTheDocument();
  });

  it("Cerrar stays off with its reason until there are three vertices", () => {
    const { add } = setup();
    expect(closeButton()).toBeDisabled();
    expect(closeButton()).toHaveAccessibleDescription("Faltan 3 vértices");
    add(A, B);
    expect(screen.getByRole("status")).toHaveTextContent("Falta 1 vértice");
    add(C);
    expect(closeButton()).toBeEnabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("closing hands over the ring as drawn", async () => {
    const { add, onClose, user } = setup();
    add(A, B, C, D);
    await user.click(closeButton());
    expect(onClose).toHaveBeenCalledWith([A, B, C, D]);
  });

  it("Deshacer takes the last vertex away, and is off with none", async () => {
    const { add, user } = setup();
    const undo = screen.getByRole("button", { name: "Deshacer" });
    expect(undo).toBeDisabled();
    add(A, B);
    await user.click(undo);
    expect(screen.getByText("1 de 12 vértices")).toBeInTheDocument();
  });

  it("a point outside Argentina is not added and says so", () => {
    const { add } = setup();
    add(SANTIAGO_DE_CHILE);
    expect(screen.getByRole("alert")).toHaveTextContent("Tocá dentro de Argentina");
    expect(screen.getByText("0 de 12 vértices")).toBeInTheDocument();
  });

  it("a point that would cross an edge is not added and says so", () => {
    const { add } = setup();
    add(A, B, C);
    // From C down across A–B
    add([-64.25, -31.8]);
    expect(screen.getByRole("alert")).toHaveTextContent("Las líneas no se pueden cruzar");
    expect(screen.getByText("3 de 12 vértices")).toBeInTheDocument();
  });

  it("stops at twelve vertices and says so", () => {
    const { add } = setup();
    add(...CIRCLE);
    add([-65, -37]);
    expect(screen.getByRole("alert")).toHaveTextContent("Llegaste al máximo de 12 vértices");
    expect(screen.getByText("12 de 12 vértices")).toBeInTheDocument();
  });

  it("a fence over the area cap cannot close, and says why", () => {
    const { add } = setup();
    add([-68, -30], [-60, -30], [-64, -38]);
    expect(closeButton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("La cerca es demasiado grande: achicala");
  });

  it("a closing edge that would cross cannot close", () => {
    const { add } = setup();
    // A bow tie: the edge back from the last vertex to A crosses B–C
    add(A, B, D, C);
    expect(closeButton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Las líneas no se pueden cruzar");
  });

  // The same rejection twice must be heard twice: the message is inserted again
  it("announces a repeated rejection again", () => {
    const { add } = setup();
    add(SANTIAGO_DE_CHILE);
    const first = screen.getByText("Tocá dentro de Argentina");
    add(SANTIAGO_DE_CHILE);
    expect(screen.getByText("Tocá dentro de Argentina")).not.toBe(first);
  });

  it("a valid point clears the last rejection", () => {
    const { add } = setup();
    add(SANTIAGO_DE_CHILE, A);
    expect(screen.queryByText("Tocá dentro de Argentina")).not.toBeInTheDocument();
  });

  it("Cancelar and Escape both leave the mode", async () => {
    const { onCancel, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
