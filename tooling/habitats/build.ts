// Builds src/data/habitats.geojson from RESOLVE Ecoregions 2017 (CC-BY 4.0). Run with `pnpm habitats:build`.
// Offline preprocessing: the app only reads the committed output.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import mapshaper from "mapshaper";
import { ARGENTINA_OUTLINE } from "../../src/data/argentina-outline";

type Position = [number, number];
type Polygon = Position[][];
type Geometry = { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry | null };
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

const [WEST, SOUTH, EAST, NORTH] = [-74, -56, -53, -21];

const QUERY = new URL(
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Resolve_Ecoregions/FeatureServer/0/query",
);
QUERY.search = new URLSearchParams({
  where: "1=1",
  geometry: `${WEST},${SOUTH},${EAST},${NORTH}`,
  geometryType: "esriGeometryEnvelope",
  inSR: "4326",
  outSR: "4326",
  spatialRel: "esriSpatialRelIntersects",
  outFields: "ECO_NAME",
  maxAllowableOffset: "0.02",
  f: "geojson",
}).toString();

// docs/brief.md §6; anything else touching the envelope (Atacama, Matorral, Cerrado, Pantanal, restingas) is dropped
const HABITAT_BY_ECOREGION: Record<string, string> = {
  "Southern Andean Yungas": "forest",
  "Alto Paraná Atlantic forests": "forest",
  "Araucaria moist forests": "forest",
  "Valdivian temperate forests": "forest",
  "Magellanic subpolar forests": "forest",
  "Bolivian montane dry forests": "forest",
  "Humid Pampas": "grassland",
  Espinal: "grassland",
  "Uruguayan savanna": "grassland",
  "Humid Chaco": "grassland",
  "Paraná flooded savanna": "waters-edge",
  "Southern Cone Mesopotamian savanna": "waters-edge",
  "Central Andean puna": "mountain",
  "Central Andean dry puna": "mountain",
  "Southern Andean steppe": "mountain",
  "High Monte": "mountain",
  "Rock and Ice": "mountain",
  "Dry Chaco": "rough-terrain",
  "Low Monte": "rough-terrain",
  "Patagonian steppe": "rough-terrain",
};

// Approximate continental shelf (~200 m isobath), from the mouth of the Río de la Plata to south of
// Tierra del Fuego. The western edge runs inland on purpose: erasing the outline leaves the coast.
const SHELF: Position[] = [
  [-56.85, -36.35],
  [-53.8, -36.0],
  [-55.0, -37.5],
  [-56.0, -39.5],
  [-57.5, -41.5],
  [-59.0, -43.5],
  [-60.0, -45.5],
  [-60.5, -47.5],
  [-59.0, -49.0],
  [-57.0, -50.5],
  [-56.8, -52.0],
  [-58.0, -53.5],
  [-59.5, -54.6],
  [-62.5, -55.0],
  [-65.0, -55.3],
  [-66.3, -55.05],
  [-66.6, -54.6],
  [-68.0, -54.0],
  [-68.35, -52.75],
  [-69.0, -51.9],
  [-69.5, -50.0],
  [-68.5, -48.0],
  [-68.0, -46.0],
  [-66.0, -44.0],
  [-65.5, -42.5],
  [-65.5, -41.0],
  [-63.0, -40.5],
  [-62.5, -39.0],
  [-60.0, -38.3],
  [-57.9, -37.5],
  [-56.85, -36.35],
];

// Islas Malvinas: hand-drawn hull of both main islands, a hole so the sea never paints land
const MALVINAS: Position[] = [
  [-61.5, -51.2],
  [-60.3, -50.95],
  [-58.9, -51.15],
  [-57.65, -51.4],
  [-57.65, -51.75],
  [-58.4, -52.3],
  [-59.6, -52.45],
  [-60.7, -52.3],
  [-61.5, -51.85],
  [-61.5, -51.2],
];

function insideEnvelope(ring: Position[]): boolean {
  return ring.every(([lng, lat]) => lng >= WEST && lng <= EAST && lat >= SOUTH && lat <= NORTH);
}

function polygonsOf(geometry: Geometry): Polygon[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

// "Rock and Ice" is one worldwide polygon with ~22 000 rings: keep the rings inside the envelope,
// each as its own polygon (they are separate ice fields, not holes)
function localPolygons(feature: Feature): Polygon[] {
  if (!feature.geometry) return [];
  const polygons = polygonsOf(feature.geometry);
  if (feature.properties.ECO_NAME === "Rock and Ice") {
    return polygons.flatMap((p) => p.filter(insideEnvelope).map((ring) => [ring]));
  }
  return polygons;
}

function toHabitats(source: FeatureCollection): FeatureCollection {
  const features: Feature[] = [];
  for (const feature of source.features) {
    const habitat = HABITAT_BY_ECOREGION[String(feature.properties.ECO_NAME)];
    if (!habitat) continue;
    const coordinates = localPolygons(feature);
    if (coordinates.length === 0) continue;
    features.push({ type: "Feature", properties: { habitat }, geometry: { type: "MultiPolygon", coordinates } });
  }
  return { type: "FeatureCollection", features };
}

const OUTLINE: FeatureCollection = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: ARGENTINA_OUTLINE }],
};

const SEA: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { habitat: "sea" }, geometry: { type: "Polygon", coordinates: [SHELF, MALVINAS] } },
  ],
};

async function run(commands: string, input: Record<string, FeatureCollection>): Promise<FeatureCollection> {
  const output = await mapshaper.applyCommands(commands, input);
  return JSON.parse(String(output["out.json"])) as FeatureCollection;
}

const OUT = "-o out.json format=geojson precision=0.001";

async function main() {
  const response = await fetch(QUERY);
  if (!response.ok) throw new Error(`RESOLVE answered ${response.status}`);
  const ecoregions = (await response.json()) as FeatureCollection;

  // Shared arcs survive the dissolve, so simplifying afterwards keeps neighbors from gapping or overlapping
  const land = await run(
    "-i eco.json -clip clip.json -dissolve habitat -simplify 60% keep-shapes " +
      `-filter-slivers min-area=40km2 -clean ${OUT}`,
    { "eco.json": toHabitats(ecoregions), "clip.json": OUTLINE },
  );
  const sea = await run(`-i sea.json -erase clip.json -clean ${OUT}`, { "sea.json": SEA, "clip.json": OUTLINE });

  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: [...land.features, ...sea.features].sort((a, b) =>
      String(a.properties.habitat).localeCompare(String(b.properties.habitat)),
    ),
  };
  const path = join(__dirname, "..", "..", "src", "data", "habitats.geojson");
  const text = JSON.stringify(collection);
  writeFileSync(path, text);
  console.log(`${collection.features.length} habitats, ${(text.length / 1024).toFixed(1)} KB → ${path}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
