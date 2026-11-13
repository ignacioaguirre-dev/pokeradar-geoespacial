// Kept apart from base-map so the check runs without downloading MapLibre
export function supportsWebGL2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
