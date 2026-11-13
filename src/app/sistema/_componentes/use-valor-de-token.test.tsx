import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useValorDeToken } from "./use-valor-de-token";

afterEach(() => document.documentElement.style.removeProperty("--color-prueba"));

describe("useValorDeToken", () => {
  it("lee el valor del token desde el documento", () => {
    document.documentElement.style.setProperty("--color-prueba", " #123456 ");
    const { result } = renderHook(() => useValorDeToken("prueba"));
    expect(result.current).toBe("#123456");
  });

  it("devuelve vacío si el token no existe", () => {
    const { result } = renderHook(() => useValorDeToken("inexistente"));
    expect(result.current).toBe("");
  });
});
