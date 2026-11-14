import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

// The real value is only known in the browser; the server snapshot is empty
export function useTokenValue(name: string): string {
  return useSyncExternalStore(
    noSubscription,
    () => getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim(),
    () => "",
  );
}
