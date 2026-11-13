import { describe, expect, it } from "vitest";
import { cumpleUso, USO_DE_COLOR } from "./usos";

describe("cumpleUso", () => {
  it("compara contra el mínimo del uso", () => {
    expect(cumpleUso(4.5, USO_DE_COLOR.texto)).toBe(true);
    expect(cumpleUso(4.49, USO_DE_COLOR.texto)).toBe(false);
    expect(cumpleUso(3, USO_DE_COLOR.energia)).toBe(true);
    expect(cumpleUso(2.9, USO_DE_COLOR["borde-control"])).toBe(false);
  });

  it("devuelve null cuando el uso no tiene mínimo", () => {
    expect(cumpleUso(1.2, USO_DE_COLOR.estructura)).toBeNull();
    expect(cumpleUso(1, USO_DE_COLOR.fondo)).toBeNull();
  });
});
