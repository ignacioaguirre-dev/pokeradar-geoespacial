"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { BIOME_OPACITY } from "@/domain/color/biome";

// Same order and fills as the map: each swatch is its biome at the layer's opacity over the ground it covers
const PAINTED = [
  { habitat: "forest", ground: "bg-map-land", fill: "bg-biome-forest" },
  { habitat: "grassland", ground: "bg-map-land", fill: "bg-biome-grassland" },
  { habitat: "waters-edge", ground: "bg-map-land", fill: "bg-biome-waters-edge" },
  { habitat: "mountain", ground: "bg-map-land", fill: "bg-biome-mountain" },
  { habitat: "rough-terrain", ground: "bg-map-land", fill: "bg-biome-rough-terrain" },
  { habitat: "sea", ground: "bg-map-sea", fill: "bg-biome-sea" },
] as const;

export function HabitatLegend({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations("Map");
  const tHabitat = useTranslations("Habitats");
  const [open, setOpen] = useState(false);
  const listId = useId();
  // Reset while rendering, so the list does not pop open again by itself once re-enabled
  if (disabled && open) setOpen(false);
  const expanded = open;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !expanded) return;
    setOpen(false);
    event.currentTarget.querySelector("button")?.focus();
  }

  return (
    <div className="pointer-events-auto relative" onKeyDown={handleKeyDown}>
      {expanded ? (
        // Opens upward so it never pushes the controls or covers the brand
        <ul
          id={listId}
          aria-label={t("legendList")}
          className="absolute bottom-full left-0 mb-2 flex w-max flex-col gap-2 rounded-panel border border-structure bg-surface p-3 text-body"
        >
          {PAINTED.map(({ habitat, ground, fill }) => (
            <li key={habitat} className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-4 shrink-0 rounded-control border border-control ${ground}`}>
                <span className={`block size-full ${fill}`} style={{ opacity: BIOME_OPACITY }} />
              </span>
              {tHabitat(habitat)}
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        variant="secondary"
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="px-4!"
      >
        {t("legend")}
      </Button>
    </div>
  );
}
