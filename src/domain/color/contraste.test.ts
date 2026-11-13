import { describe, expect, it } from "vitest";
import { relacionDeContraste } from "./contraste";

describe("relacionDeContraste", () => {
  it("da 21 entre negro y blanco y 1 entre iguales", () => {
    expect(relacionDeContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(relacionDeContraste("#7A7266", "#7A7266")).toBeCloseTo(1, 5);
  });

  it("es simétrica", () => {
    expect(relacionDeContraste("#0B0E12", "#F1EDE4")).toBeCloseTo(
      relacionDeContraste("#F1EDE4", "#0B0E12"),
      10,
    );
  });

  it("acepta minúsculas", () => {
    expect(relacionDeContraste("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("rechaza un formato que no sea #RRGGBB", () => {
    expect(() => relacionDeContraste("#FFF", "#000000")).toThrow(/#RRGGBB/);
    expect(() => relacionDeContraste("rojo", "#000000")).toThrow(/#RRGGBB/);
  });
});
