type Probe = { webgl2: boolean; software: boolean };

let cached: Probe | undefined;

// Renderers that draw on the CPU: no graphics hardware, or a blocked GPU
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

function probe(): Probe {
  if (cached === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      // The unmasked name when the browser shares it; the masked one still says SwiftShader in Chrome
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "";
      cached = { webgl2: gl !== null, software: SOFTWARE.test(renderer) };
      // Browsers cap live contexts; the probe must not hold one the map will need
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      cached = { webgl2: false, software: false };
    }
  }
  return cached;
}

// Kept apart from base-map so the check runs without downloading MapLibre
// Memoized: it is read on every render, and each probe would open a new WebGL context
export function supportsWebGL2(): boolean {
  return probe().webgl2;
}

// WebGL drawn by the CPU: a globe in motion freezes the page for whole seconds per frame there
export function rendersInSoftware(): boolean {
  return probe().software;
}
