import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tag } from "./tag";

function mark(container: HTMLElement): string {
  return container.querySelector('[aria-hidden="true"]')?.textContent ?? "";
}

describe("Tag", () => {
  it("shows the text", () => {
    render(<Tag variant="habitat">Bosque</Tag>);
    expect(screen.getByText("Bosque")).toBeInTheDocument();
  });

  it("tells variants apart by their mark, not only by color", () => {
    const marks = (["habitat", "condition", "neutral"] as const).map((v) => {
      const { container, unmount } = render(<Tag variant={v}>X</Tag>);
      const m = mark(container);
      unmount();
      return m;
    });
    expect(marks.every((m) => m.length > 0)).toBe(true);
    expect(new Set(marks).size).toBe(3);
  });
});
