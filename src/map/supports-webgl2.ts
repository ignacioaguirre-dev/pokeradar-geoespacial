let cached: boolean | undefined;

// Kept apart from base-map so the check runs without downloading MapLibre
// Memoized: it is read on every render, and each probe would open a new WebGL context
export function supportsWebGL2(): boolean {
  if (cached === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      cached = gl !== null;
      // Browsers cap live contexts; the probe must not hold one the map will need
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      cached = false;
    }
  }
  return cached;
}
