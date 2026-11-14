// next.config.ts and vitest.config.mts load .geojson as JSON; the shape is checked by src/data/habitats.test.ts
declare module "*/habitats.geojson" {
  import type { HabitatCollection } from "@/map/habitats";
  const habitats: HabitatCollection;
  export default habitats;
}
