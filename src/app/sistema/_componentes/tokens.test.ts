import { describe, expect, it } from "vitest";
import { contrasteSobreFondo, etiquetaDeUso, usoDe } from "./tokens";

describe("contrasteSobreFondo", () => {
  it("queda pendiente mientras los valores no se leyeron", () => {
    expect(contrasteSobreFondo("texto", "", "#0B0E12")).toEqual({ tipo: "pendiente" });
    expect(contrasteSobreFondo("texto", "#F1EDE4", "")).toEqual({ tipo: "pendiente" });
  });

  it("el fondo no tiene contraste contra sí mismo", () => {
    expect(contrasteSobreFondo("fondo", "#0B0E12", "#0B0E12")).toEqual({ tipo: "base" });
  });

  it("mide el contraste del resto", () => {
    const resultado = contrasteSobreFondo("texto", "#F1EDE4", "#0B0E12");
    expect(resultado.tipo).toBe("medido");
    if (resultado.tipo === "medido") expect(resultado.relacion).toBeCloseTo(16.55, 1);
  });

  it("marca si el uso del token cumple su mínimo", () => {
    expect(contrasteSobreFondo("texto", "#F1EDE4", "#0B0E12")).toMatchObject({ cumple: true });
    expect(contrasteSobreFondo("texto", "#3B3832", "#0B0E12")).toMatchObject({ cumple: false });
    expect(contrasteSobreFondo("estructura", "#3B3832", "#0B0E12")).toMatchObject({ cumple: null });
  });
});

describe("etiquetaDeUso", () => {
  it("nombra el uso y su mínimo", () => {
    expect(etiquetaDeUso(usoDe("texto"))).toBe("Texto · mín. 4,5");
    expect(etiquetaDeUso(usoDe("energia"))).toBe("Gráfico · mín. 3");
    expect(etiquetaDeUso(usoDe("estructura"))).toBe("Decorativo");
  });
});
