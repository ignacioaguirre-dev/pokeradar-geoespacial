"use client";

import { useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

// CSS durations come as "240ms" or "0.9s"; anything unreadable means no animation
export function parseDuration(raw: string): number {
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(raw.trim());
  if (!match) return 0;
  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
}

// The stylesheet zeroes the tokens under reduced motion, so a change of that preference re-reads them
function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

// Milliseconds of a --duration-* token, so script-driven motion follows the same tokens as CSS.
// Only for client subtrees (the server snapshot is 0); it reads the token once and again only when the
// reduced-motion preference changes, so a token changed at runtime is not picked up
export function useDurationToken(name: `--duration-${string}`): number {
  return useSyncExternalStore(
    subscribe,
    () => parseDuration(getComputedStyle(document.documentElement).getPropertyValue(name)),
    () => 0,
  );
}
