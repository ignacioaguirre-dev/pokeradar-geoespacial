import { areaKm2 } from "@/domain/geometry/area";
import { pointInPolygon } from "@/domain/geometry/point-in-polygon";
import { createRng, randomPointInRing } from "@/domain/geometry/random";
import type { LngLat, Ring } from "@/domain/geometry/types";
import type { Habitat } from "@/domain/habitat/types";
import type { HabitatArea, Sighting, Site, SpeciesRef } from "./types";

// A rare species is a single find somewhere: one spot.
const RARE_SIGHTINGS = 1;
// Caves and cities are a handful of small sites; more points would pile up on the same spot.
const SITE_SIGHTINGS = 3;
// Area habitats span whole ecoregions: enough spread to show up in several fences (~1 700 points in all).
const AREA_SIGHTINGS = 5;

// Degrees around a curated site. Just under 0.15 so rounding to 3 decimals never pushes a point past it.
export const MAX_SITE_OFFSET = 0.149;

// A hole or a thin polygon can reject a sample; past this many tries the point is skipped.
const MAX_ATTEMPTS = 50;

function countFor(habitat: Habitat): number {
  if (habitat === "rare") return RARE_SIGHTINGS;
  if (habitat === "cave" || habitat === "urban") return SITE_SIGHTINGS;
  return AREA_SIGHTINGS;
}

// ~110 m: plenty for a map dot and keeps the payload small.
const round = (value: number) => Math.round(value * 1000) / 1000;
const roundPoint = ([lng, lat]: LngLat): LngLat => [round(lng), round(lat)];

type WeightedPolygon = { readonly rings: readonly Ring[]; readonly cumulative: number };

function weigh(polygons: readonly (readonly Ring[])[]): WeightedPolygon[] {
  const weighted: WeightedPolygon[] = [];
  let total = 0;
  for (const rings of polygons) {
    const [outer, ...holes] = rings;
    if (!outer) continue;
    const area = areaKm2(outer) - holes.reduce((sum, hole) => sum + areaKm2(hole), 0);
    if (area <= 0) continue;
    total += area;
    weighted.push({ rings, cumulative: total });
  }
  return weighted;
}

function pickPolygon(polygons: WeightedPolygon[], rng: () => number): readonly Ring[] {
  const target = rng() * polygons[polygons.length - 1].cumulative;
  return (polygons.find((p) => target < p.cumulative) ?? polygons[polygons.length - 1]).rings;
}

// Rounded before the check, so the stored point is the one known to be inside.
function pointInArea(polygons: WeightedPolygon[], rng: () => number): LngLat | null {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rings = pickPolygon(polygons, rng);
    const sample = randomPointInRing(rings[0], rng);
    if (!sample) continue;
    const point = roundPoint(sample);
    if (pointInPolygon(point, rings)) return point;
  }
  return null;
}

// sqrt keeps the density even over the disc instead of crowding the center.
function pointNearSite(sites: readonly Site[], rng: () => number): LngLat {
  const [lng, lat] = sites[Math.floor(rng() * sites.length)].point;
  const radius = MAX_SITE_OFFSET * Math.sqrt(rng());
  const angle = 2 * Math.PI * rng();
  return roundPoint([lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)]);
}

// Seeded per species, so a species lands in the same places whatever else is in the list.
export function distribute(
  species: readonly SpeciesRef[],
  areas: readonly HabitatArea[],
  sites: readonly Site[],
): Sighting[] {
  const polygonsBy = new Map<Habitat, WeightedPolygon[]>();
  for (const area of areas) {
    polygonsBy.set(area.habitat, [...(polygonsBy.get(area.habitat) ?? []), ...weigh(area.polygons)]);
  }
  const sitesBy = Map.groupBy(sites, (site) => site.habitat);

  const sightings: Sighting[] = [];
  for (const { id, habitat } of [...species].sort((a, b) => a.id - b.id)) {
    const rng = createRng(id);
    const polygons = polygonsBy.get(habitat);
    const habitatSites = sitesBy.get(habitat);
    for (let i = 0; i < countFor(habitat); i++) {
      const point =
        polygons && polygons.length > 0
          ? pointInArea(polygons, rng)
          : habitatSites
            ? pointNearSite(habitatSites, rng)
            : null;
      if (point) sightings.push({ speciesId: id, point });
    }
  }
  return sightings;
}
