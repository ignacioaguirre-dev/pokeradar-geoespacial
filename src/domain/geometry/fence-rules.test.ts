import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canAddVertex, canClose, FENCE_RULES, validateFence } from "./fence-rules";
import type { LngLat, Ring } from "./types";

const everywhere = () => true;
const nowhere = () => false;

// Regular polygon around a point in Argentina; small enough to stay under the area cap.
function regular(count: number, radius = 1, [lng, lat]: LngLat = [-64, -30]): Ring {
  return Array.from({ length: count }, (_, k): LngLat => {
    const angle = (2 * Math.PI * k) / count;
    return [lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)];
  });
}

// ~6° × 6° in the north: well over 250 000 km².
const hugeSquare: Ring = [
  [-65, -28],
  [-59, -28],
  [-59, -22],
  [-65, -22],
];

// ~1° × 1° around Córdoba: ~10 000 km².
const smallSquare: Ring = [
  [-65, -32],
  [-64, -32],
  [-64, -31],
  [-65, -31],
];

// Closing (2,2) → (0,0) crosses (2,0) → (0,2).
const bowtie: Ring = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
];

describe("FENCE_RULES", () => {
  it("documents the decided limits", () => {
    expect(FENCE_RULES).toEqual({ minVertices: 3, maxVertices: 12, maxAreaKm2: 250_000 });
  });
});

describe("canAddVertex", () => {
  it("rejects a vertex outside the territory", () => {
    expect(canAddVertex(smallSquare.slice(0, 2), [-64, -31], nowhere)).toEqual({ kind: "outside" });
  });

  it("asks the territory about the new vertex only", () => {
    const asked: LngLat[] = [];
    canAddVertex(smallSquare.slice(0, 2), [-64, -31], (p) => {
      asked.push(p);
      return true;
    });
    expect(asked).toEqual([[-64, -31]]);
  });

  it("rejects the 13th vertex", () => {
    const twelve = regular(12);
    expect(canAddVertex(twelve, [-64, -30], everywhere)).toEqual({ kind: "too-many-vertices" });
  });

  it("accepts the 12th vertex", () => {
    const twelve = regular(12);
    expect(canAddVertex(twelve.slice(0, 11), twelve[11], everywhere)).toBeNull();
  });

  it("rejects a new edge that crosses an earlier one", () => {
    expect(canAddVertex(bowtie.slice(0, 3), [1, -1], everywhere)).toEqual({ kind: "crossing" });
  });

  it("rejects a new vertex that lands on an earlier edge", () => {
    expect(canAddVertex(bowtie.slice(0, 3), [1, 0], everywhere)).toEqual({ kind: "crossing" });
  });

  it("rejects a new vertex equal to an earlier, non-adjacent one", () => {
    const open: Ring = [
      [0, 0],
      [2, 0],
      [2, 2],
    ];
    expect(canAddVertex(open, [0, 0], everywhere)).toEqual({ kind: "crossing" });
  });

  it("rejects a vertex equal to the previous one (a zero-length edge)", () => {
    expect(canAddVertex([[0, 0]], [0, 0], everywhere)).toEqual({ kind: "crossing" });
    expect(canAddVertex(smallSquare.slice(0, 3), smallSquare[2], everywhere)).toEqual({ kind: "crossing" });
  });

  it("rejects folding back over the previous edge", () => {
    const open: Ring = [
      [0, 0],
      [2, 0],
    ];
    expect(canAddVertex(open, [1, 0], everywhere)).toEqual({ kind: "crossing" });
    expect(canAddVertex(open, [-1, 0], everywhere)).toEqual({ kind: "crossing" });
  });

  it("accepts continuing straight along the previous edge", () => {
    const open: Ring = [
      [0, 0],
      [1, 0],
    ];
    expect(canAddVertex(open, [2, 0], everywhere)).toBeNull();
  });

  it("accepts a valid vertex", () => {
    expect(canAddVertex(smallSquare.slice(0, 3), smallSquare[3], everywhere)).toBeNull();
  });

  it("accepts any first, second and third vertex inside (no edges to cross yet)", () => {
    expect(canAddVertex([], [0, 0], everywhere)).toBeNull();
    expect(canAddVertex([[0, 0]], [2, 0], everywhere)).toBeNull();
    expect(
      canAddVertex(
        [
          [0, 0],
          [2, 0],
        ],
        [0, 2],
        everywhere,
      ),
    ).toBeNull();
  });

  it("checks the territory before the vertex count", () => {
    expect(canAddVertex(regular(12), [-64, -30], nowhere)).toEqual({ kind: "outside" });
  });
});

describe("canClose", () => {
  it("reports how many vertices are missing", () => {
    expect(canClose([])).toEqual({ kind: "too-few-vertices", missing: 3 });
    expect(canClose([[0, 0]])).toEqual({ kind: "too-few-vertices", missing: 2 });
    expect(
      canClose([
        [0, 0],
        [1, 0],
      ]),
    ).toEqual({ kind: "too-few-vertices", missing: 1 });
  });

  it("rejects a closing edge that crosses another (bowtie)", () => {
    expect(canClose(bowtie)).toEqual({ kind: "crossing" });
  });

  it("rejects a flat ring whose closing edge runs back over the others", () => {
    expect(
      canClose([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toEqual({ kind: "crossing" });
  });

  it("rejects a closing edge that runs back over the first edge", () => {
    // Closing (1,0) → (0,0) lies on the first edge (0,0) → (2,0).
    expect(
      canClose([
        [0, 0],
        [2, 0],
        [1, 1],
        [1, 0],
      ]),
    ).toEqual({ kind: "crossing" });
  });

  it("rejects a fence over the area cap and reports its area", () => {
    const problem = canClose(hugeSquare);
    expect(problem).toEqual({ kind: "too-large", areaKm2: expect.any(Number) });
    expect((problem as { areaKm2: number }).areaKm2).toBeGreaterThan(FENCE_RULES.maxAreaKm2);
  });

  it("accepts a fence under the area cap", () => {
    expect(canClose(smallSquare)).toBeNull();
  });

  it("accepts the smallest fence: a triangle", () => {
    expect(canClose(smallSquare.slice(0, 3))).toBeNull();
  });
});

describe("validateFence", () => {
  it("reports too few vertices first", () => {
    expect(validateFence(bowtie.slice(0, 2), nowhere)).toEqual({ kind: "too-few-vertices", missing: 1 });
  });

  it("reports too many vertices before crossings", () => {
    expect(validateFence([...bowtie, ...regular(9)], nowhere)).toEqual({ kind: "too-many-vertices" });
  });

  it("reports crossings before the area and the territory", () => {
    expect(validateFence(bowtie, nowhere)).toEqual({ kind: "crossing" });
  });

  it("finds a crossing between two edges that are not the closing one", () => {
    // Edge 0 (0,0)→(4,0) crosses edge 2 (3,1)→(3,-1); the closing edge crosses nothing.
    const ring: Ring = [
      [0, 0],
      [4, 0],
      [4, 1],
      [3, 1],
      [3, -1],
      [0, -1],
    ];
    expect(validateFence(ring, everywhere)).toEqual({ kind: "crossing" });
  });

  it("finds a repeated vertex", () => {
    const ring: Ring = [
      [0, 0],
      [2, 0],
      [2, 2],
      [2, 2],
      [0, 2],
    ];
    expect(validateFence(ring, everywhere)).toEqual({ kind: "crossing" });
  });

  it("reports the area before the territory", () => {
    expect(validateFence(hugeSquare, nowhere)).toEqual({ kind: "too-large", areaKm2: expect.any(Number) });
  });

  it("reports a vertex outside the territory last", () => {
    const outside: LngLat = smallSquare[2];
    const isInside = (p: LngLat) => p[0] !== outside[0] || p[1] !== outside[1];
    expect(validateFence(smallSquare, isInside)).toEqual({ kind: "outside" });
  });

  it("accepts a valid fence", () => {
    expect(validateFence(smallSquare, everywhere)).toBeNull();
  });

  it("accepts a valid 12-vertex fence", () => {
    expect(validateFence(regular(12), everywhere)).toBeNull();
  });

  it("accepts a valid concave fence", () => {
    const u: Ring = [
      [-65, -32],
      [-63, -32],
      [-63, -30],
      [-63.5, -30],
      [-63.5, -31.5],
      [-64.5, -31.5],
      [-64.5, -30],
      [-65, -30],
    ];
    expect(validateFence(u, everywhere)).toBeNull();
  });
});

// Mirrors the generator in random.test.ts (fast-check may only be imported from tests);
// a larger radius so some rings go over the area cap.
const convexRing = fc
  .record({
    lng: fc.double({ min: -73, max: -53, noNaN: true }),
    lat: fc.double({ min: -55, max: -22, noNaN: true }),
    radius: fc.double({ min: 0.001, max: 6, noNaN: true }),
    offset: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
    jitters: fc.array(fc.double({ min: -0.4, max: 0.4, noNaN: true }), { minLength: 3, maxLength: 12 }),
  })
  .map(({ lng, lat, radius, offset, jitters }): Ring => {
    const step = (2 * Math.PI) / jitters.length;
    return jitters.map((jitter, k) => {
      const angle = offset + step * (k + jitter);
      return [lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)];
    });
  });

describe("fence rule properties", () => {
  it("canClose never reports a crossing on a convex ring", () => {
    fc.assert(
      fc.property(convexRing, (ring) => {
        expect(canClose(ring)?.kind).not.toBe("crossing");
      }),
      { seed: 42 },
    );
  });

  it("validateFence on a convex ring inside the territory can only report too-large", () => {
    fc.assert(
      fc.property(convexRing, (ring) => {
        const problem = validateFence(ring, everywhere);
        expect(problem === null || problem.kind === "too-large").toBe(true);
      }),
      { seed: 42 },
    );
  });

  it("validateFence does not depend on the winding direction", () => {
    fc.assert(
      fc.property(convexRing, (ring) => {
        const forward = validateFence(ring, everywhere);
        const backward = validateFence([...ring].reverse(), everywhere);
        expect(backward?.kind).toBe(forward?.kind);
        if (forward?.kind === "too-large" && backward?.kind === "too-large") {
          expect(backward.areaKm2).toBeCloseTo(forward.areaKm2, 6);
        }
      }),
      { seed: 42 },
    );
  });

  it("the generator covers both outcomes, so the properties above are not vacuous", () => {
    const kinds = new Set(
      fc.sample(convexRing, { numRuns: 200, seed: 42 }).map((ring) => validateFence(ring, everywhere)?.kind ?? "ok"),
    );
    expect(kinds).toEqual(new Set(["ok", "too-large"]));
  });
});
