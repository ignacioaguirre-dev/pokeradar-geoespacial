import { useEffect, useState } from "react";

// Reads a promise without suspending: the caller keeps rendering and gets the value when it lands.
// A rejection leaves it undefined, the same as a value that never came.
export function useResolved<T>(promise: Promise<T> | undefined): T | undefined {
  const [settled, setSettled] = useState<{ promise: Promise<T>; value: T } | null>(null);
  useEffect(() => {
    if (!promise) return;
    let live = true;
    promise.then(
      (value) => {
        if (live) setSettled({ promise, value });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [promise]);
  // Keyed by promise so a replaced one never shows the previous value
  return settled && settled.promise === promise ? settled.value : undefined;
}
