import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { LngLat } from "@/domain/geometry/types";

export type SweepCreature = {
  readonly id: number;
  readonly point: LngLat;
  // The accessible name, already worded by the app ("Ver Pikachu"): the map has no texts of its own
  readonly label: string;
  readonly sprite: string;
};

type Handlers = { onSelect(id: number): void; onIntent(id: number): void };

// Sprite size inside the ochre ring; the ring makes the touch target 48 px
const SPRITE_PX = 40;

// A real button, not MapLibre's pin: focusable, named and activated with Enter or Space.
// The sprite is decorative (alt="") because the button carries the creature's name
function markerElement(creature: SweepCreature, index: number, { onSelect, onIntent }: Handlers): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sweep-marker";
  button.setAttribute("aria-label", creature.label);
  button.dataset.creature = String(creature.id);

  // MapLibre positions the button with a transform, so the entrance animates this inner body instead
  const body = document.createElement("span");
  body.className = "sweep-marker__body";
  body.style.setProperty("--marker-index", String(index));

  const sprite = document.createElement("img");
  sprite.src = creature.sprite;
  sprite.alt = "";
  sprite.width = SPRITE_PX;
  sprite.height = SPRITE_PX;
  sprite.decoding = "async";
  sprite.draggable = false;
  // Anonymous, so it reuses the connection the page preconnects to raw.githubusercontent.com
  sprite.crossOrigin = "anonymous";

  // The habitat shape mark: the variant never relies on the ochre alone
  const mark = document.createElement("span");
  mark.className = "sweep-marker__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "●";

  body.append(sprite, mark);
  button.append(body);

  button.addEventListener("click", () => onSelect(creature.id));
  // Hover and focus come before the tap: enough time to fetch the detail
  button.addEventListener("mouseenter", () => onIntent(creature.id));
  button.addEventListener("focus", () => onIntent(creature.id));
  return button;
}

// In detection order, which is also the DOM and tab order
export function addMarkers(map: MapLibreMap, creatures: readonly SweepCreature[], handlers: Handlers): Marker[] {
  return creatures.map((creature, index) =>
    new Marker({ element: markerElement(creature, index, handlers), anchor: "center" })
      .setLngLat([creature.point[0], creature.point[1]])
      .addTo(map),
  );
}
