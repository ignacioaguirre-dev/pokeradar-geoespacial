import { areaKm2 } from "./area";
import { onSegment, segmentsIntersect } from "./segments";
import type { LngLat, Ring } from "./types";

// 250 000 km² sits between Chubut and Buenos Aires: room for a province, not half the country.
export const FENCE_RULES = { minVertices: 3, maxVertices: 12, maxAreaKm2: 250_000 } as const;

export type FenceProblem =
  | { kind: "too-few-vertices"; missing: number }
  | { kind: "too-many-vertices" }
  | { kind: "crossing" }
  | { kind: "too-large"; areaKm2: number }
  | { kind: "outside" };

const CROSSING: FenceProblem = { kind: "crossing" };

// Edge i of a ring runs from vertex i to vertex i + 1, wrapping to 0 when closed.
function edge(ring: Ring, i: number): readonly [LngLat, LngLat] {
  return [ring[i], ring[(i + 1) % ring.length]];
}

// Adjacent edges always meet at their shared vertex; they only conflict when one folds back over
// the other (which also covers a zero-length edge).
function foldsBack(shared: LngLat, farA: LngLat, farB: LngLat): boolean {
  return onSegment(farA, shared, farB) || onSegment(farB, shared, farA);
}

// i < j, indices of edges in the ring read as closed.
function edgesConflict(ring: Ring, i: number, j: number): boolean {
  const [a, b] = edge(ring, i);
  const [c, d] = edge(ring, j);
  if (j === i + 1) return foldsBack(b, a, d);
  if (i === 0 && j === ring.length - 1) return foldsBack(a, b, c);
  return segmentsIntersect(a, b, c, d);
}

function conflictsWithEarlierEdges(ring: Ring, j: number): boolean {
  for (let i = 0; i < j; i++) if (edgesConflict(ring, i, j)) return true;
  return false;
}

function areaProblem(ring: Ring): FenceProblem | null {
  const area = areaKm2(ring);
  return area > FENCE_RULES.maxAreaKm2 ? { kind: "too-large", areaKm2: area } : null;
}

export function canAddVertex(open: Ring, next: LngLat, isInside: (p: LngLat) => boolean): FenceProblem | null {
  if (!isInside(next)) return { kind: "outside" };
  if (open.length >= FENCE_RULES.maxVertices) return { kind: "too-many-vertices" };
  if (open.length === 0) return null;
  const last = open[open.length - 1];
  if (onSegment(next, last, last)) return CROSSING;
  // The candidate is read as closed only to index edges; its closing edge is canClose's job.
  const candidate = [...open, next];
  return conflictsWithEarlierEdges(candidate, candidate.length - 2) ? CROSSING : null;
}

export function canClose(open: Ring): FenceProblem | null {
  if (open.length < FENCE_RULES.minVertices) {
    return { kind: "too-few-vertices", missing: FENCE_RULES.minVertices - open.length };
  }
  if (conflictsWithEarlierEdges(open, open.length - 1)) return CROSSING;
  return areaProblem(open);
}

export function validateFence(ring: Ring, isInside: (p: LngLat) => boolean): FenceProblem | null {
  if (ring.length < FENCE_RULES.minVertices) {
    return { kind: "too-few-vertices", missing: FENCE_RULES.minVertices - ring.length };
  }
  if (ring.length > FENCE_RULES.maxVertices) return { kind: "too-many-vertices" };
  for (let j = 1; j < ring.length; j++) if (conflictsWithEarlierEdges(ring, j)) return CROSSING;
  const tooLarge = areaProblem(ring);
  if (tooLarge) return tooLarge;
  return ring.every(isInside) ? null : { kind: "outside" };
}
