let cached: boolean | undefined;

// Kept apart from base-map so the check runs without downloading MapLibre
// Memoized: it is read on every render, and each probe would open a new WebGL context
export function supportsWebGL2(): boolean {
  if (cached === undefined) {
    try {
      cached = document.createElement("canvas").getContext("webgl2") !== null;
    } catch {
      cached = false;
    }
  }
  return cached;
}
