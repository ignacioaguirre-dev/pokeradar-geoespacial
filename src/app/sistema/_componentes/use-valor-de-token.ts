import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

// The real value is only known in the browser; the server snapshot is empty
export function useValorDeToken(nombre: string): string {
  return useSyncExternalStore(
    sinSuscripcion,
    () =>
      getComputedStyle(document.documentElement).getPropertyValue(`--color-${nombre}`).trim(),
    () => "",
  );
}
