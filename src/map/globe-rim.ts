import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";

// The subset of MapLibre's custom-layer projection data the rim reads
export type RimProjection = {
  mainMatrix: ArrayLike<number>;
  fallbackMatrix: ArrayLike<number>;
  clippingPlane: [number, number, number, number];
  projectionTransition: number;
};

export type RimMap = Pick<
  MapLibreMap,
  "getCanvasContainer" | "getCanvas" | "getCenter" | "addLayer" | "removeLayer" | "getLayer"
>;

export const RIM_LAYER = "globe-rim";

const STEPS = 128;
const SVG_NS = "http://www.w3.org/2000/svg";
// Web mercator's latitude limit, where the flat world ends
const MAX_LAT = 85.051129;

type Vec3 = [number, number, number];

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
}

// Column-major 4×4 times (x, y, z, 1), keeping x, y and w: the components MapLibre mixes during the morph
function project(m: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

// The inverse of MapLibre's projectToSphere: x east at lng 90, y north, z toward lng 0
function toMercator([x, y, z]: Vec3, centerX: number): [number, number] {
  const lng = Math.atan2(x, z);
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, (Math.asin(y) * 180) / Math.PI));
  let mx = lng / (2 * Math.PI) + 0.5;
  mx += Math.round(centerX - mx);
  const my = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
  return [mx, my];
}

/**
 * The globe's outline on screen, as an SVG path in CSS pixels. MapLibre clips the globe with the plane tangent
 * to its silhouette, so the outline is that plane's circle on the unit sphere, projected the way its shader does:
 * the globe position, mixed with the flat one while the projection morphs.
 */
export function rimPath(data: RimProjection, centerMercatorX: number, width: number, height: number): string {
  const [nx, ny, nz, w] = data.clippingPlane;
  const normal = normalize([nx, ny, nz]);
  const distance = -w;
  const radius = Math.sqrt(Math.max(0, 1 - distance * distance));
  const u = normalize(cross(normal, Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const v = cross(normal, u);
  const t = data.projectionTransition;
  const parts: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    const angle = (2 * Math.PI * i) / STEPS;
    const point: Vec3 = [0, 1, 2].map(
      (k) => normal[k] * distance + radius * (u[k] * Math.cos(angle) + v[k] * Math.sin(angle)),
    ) as Vec3;
    let clip = project(data.mainMatrix, ...point);
    if (t < 1) {
      const [mx, my] = toMercator(point, centerMercatorX);
      const flat = project(data.fallbackMatrix, mx, my, 0);
      clip = [0, 1, 2].map((k) => flat[k] + (clip[k] - flat[k]) * t) as [number, number, number];
    }
    const x = ((clip[0] / clip[2] + 1) / 2) * width;
    const y = ((1 - clip[1] / clip[2]) / 2) * height;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

// Full while the map is a globe, gone halfway through the morph: past that the outline is no longer the Earth's edge
export function rimOpacity(projectionTransition: number): number {
  return Math.max(0, Math.min(1, (projectionTransition - 0.5) * 2));
}

/**
 * Draws the globe's outline as a thin line over the map. A custom layer is MapLibre's public way to read, on every
 * frame, the projection its shaders use; the layer itself paints nothing, the line is SVG for a crisp CSS pixel.
 */
export function attachGlobeRim(map: RimMap, color: string): { remove(): void } {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible";
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", "1");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(path);
  map.getCanvasContainer().append(svg);

  function draw(data: RimProjection) {
    const opacity = rimOpacity(data.projectionTransition);
    svg.style.display = opacity === 0 ? "none" : "";
    if (opacity === 0) return;
    svg.style.opacity = String(opacity);
    const { clientWidth, clientHeight } = map.getCanvas();
    const centerX = (map.getCenter().lng + 180) / 360;
    path.setAttribute("d", rimPath(data, centerX, clientWidth, clientHeight));
  }

  const layer: CustomLayerInterface = {
    id: RIM_LAYER,
    type: "custom",
    renderingMode: "2d",
    render: (_gl, { defaultProjectionData }) => draw(defaultProjectionData),
  };
  map.addLayer(layer);
  return {
    remove() {
      if (map.getLayer(RIM_LAYER)) map.removeLayer(RIM_LAYER);
      svg.remove();
    },
  };
}
