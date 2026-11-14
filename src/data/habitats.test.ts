import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LngLat } from "@/domain/geometry/types";
import { HABITAT_COLLECTION as collection, HABITATS_PATH as PATH, habitatsAt, polygonsOf as polygons } from "@/testing/geo";

const AREA_HABITATS = ["forest", "grassland", "mountain", "rough-terrain", "sea", "waters-edge"];

describe("habitats.geojson", () => {
  it("is a FeatureCollection with one feature per area habitat", () => {
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features.map((f) => f.properties.habitat).sort()).toEqual(AREA_HABITATS);
  });

  it("holds only closed polygon rings", () => {
    for (const feature of collection.features) {
      expect(feature.type).toBe("Feature");
      expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
      for (const ring of polygons(feature).flat()) {
        expect(ring.length, feature.properties.habitat).toBeGreaterThanOrEqual(4);
        expect(ring.at(-1)).toEqual(ring[0]);
      }
    }
  });

  it("stays inside Argentina's bounding box with 3-decimal coordinates", () => {
    for (const feature of collection.features) {
      for (const [lng, lat] of polygons(feature).flat(2)) {
        expect(lng).toBeGreaterThanOrEqual(-74);
        expect(lng).toBeLessThanOrEqual(-53);
        expect(lat).toBeGreaterThanOrEqual(-56);
        expect(lat).toBeLessThanOrEqual(-21);
        expect(Math.round(lng * 1000) / 1000).toBe(lng);
        expect(Math.round(lat * 1000) / 1000).toBe(lat);
      }
    }
  });

  it("weighs at most 80 KB", () => {
    expect(statSync(PATH).size).toBeLessThanOrEqual(80 * 1024);
  });

  it.each<[string, LngLat, string]>([
    // Córdoba city sits in the Espinal, RESOLVE's belt between the Pampas and the Dry Chaco
    ["Córdoba", [-64.18, -31.42], "grassland"],
    ["highland Jujuy", [-65.5, -23.0], "mountain"],
    ["Iguazú", [-54.4, -25.7], "forest"],
    ["Esteros del Iberá", [-57.2, -28.6], "waters-edge"],
    ["Trelew", [-65.3, -43.2], "rough-terrain"],
    ["the Argentine Sea", [-60, -45], "sea"],
  ])("%s falls only in %s", (_name, point, habitat) => {
    expect(habitatsAt(point)).toEqual([habitat]);
  });

  it.each<[string, LngLat]>([
    ["Montevideo", [-56.16, -34.9]],
    ["Santiago de Chile", [-70.65, -33.45]],
    ["Asunción", [-57.58, -25.26]],
    ["Islas Malvinas", [-59.0, -51.7]],
  ])("paints nothing on %s", (_name, point) => {
    expect(habitatsAt(point)).toEqual([]);
  });
});
