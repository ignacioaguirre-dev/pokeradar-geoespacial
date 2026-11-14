"use client";

// Only MapStage's dynamic import reaches this module, so the habitat data ships in the deferred map chunk
import habitats from "@/data/habitats.geojson";
import { BaseMap } from "@/map/base-map";
import type { ComponentProps } from "react";

export function HabitatMap(props: Omit<ComponentProps<typeof BaseMap>, "habitats">) {
  return <BaseMap habitats={habitats} {...props} />;
}
