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

// The list itself, shared by the desktop popover and the phone sheet
export function HabitatSwatches({ id, className = "" }: { id?: string; className?: string }) {
  const t = useTranslations("Map");
  const tHabitat = useTranslations("Habitats");
  return (
    <ul id={id} aria-label={t("legendList")} className={`flex flex-col gap-2 text-body ${className}`}>
      {PAINTED.map(({ habitat, ground, fill }) => (
        <li key={habitat} className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-4 shrink-0 rounded-control border border-control ${ground}`}>
            <span className={`block size-full ${fill}`} style={{ opacity: BIOME_OPACITY }} />
          </span>
          {tHabitat(habitat)}
        </li>
      ))}
    </ul>
  );
}

export function HabitatLegend({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations("Map");
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
        <HabitatSwatches
          id={listId}
          className="absolute bottom-full left-0 mb-2 w-max rounded-panel border border-structure bg-surface p-3"
        />
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
