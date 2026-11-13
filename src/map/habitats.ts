// Structural GeoJSON for the habitat layer: src/map does not import src/data, so the app hands it over
type Position = [number, number];

export type AreaHabitat = "forest" | "grassland" | "waters-edge" | "mountain" | "rough-terrain" | "sea";

export type HabitatCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { habitat: string };
    geometry: { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };
  }[];
};
