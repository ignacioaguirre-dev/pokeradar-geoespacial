import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RENDERER = 0x1f01;
const UNMASKED = 0x9246;

function fakeCanvas(renderer: string | null) {
  const gl =
    renderer === null
      ? null
      : {
          RENDERER,
          getExtension: (name: string) =>
            name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: UNMASKED } : { loseContext: () => {} },
          getParameter: () => renderer,
        };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => gl }) });
}

async function load() {
  vi.resetModules();
  return import("./supports-webgl2");
}

describe("supports-webgl2", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "Microsoft Basic Render Driver",
  ])("tells a renderer that draws on the CPU: %s", async (renderer) => {
    fakeCanvas(renderer);
    const { supportsWebGL2, rendersInSoftware } = await load();
    expect(supportsWebGL2()).toBe(true);
    expect(rendersInSoftware()).toBe(true);
  });

  it("takes a graphics card for hardware", async () => {
    fakeCanvas("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)");
    const { rendersInSoftware } = await load();
    expect(rendersInSoftware()).toBe(false);
  });

  it("without WebGL2 there is neither map nor software rendering", async () => {
    fakeCanvas(null);
    const { supportsWebGL2, rendersInSoftware } = await load();
    expect(supportsWebGL2()).toBe(false);
    expect(rendersInSoftware()).toBe(false);
  });
});
