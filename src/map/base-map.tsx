"use client";

// Static on purpose: next/dynamic already defers this whole file, so import() here would chain a second download
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Ref, useEffect, useEffectEvent, useId, useImperativeHandle, useRef } from "react";
import { ARGENTINA_BOUNDS, MAX_BOUNDS, MIN_ZOOM } from "./argentina";
import { readMapColors } from "./colors";
import type { CompactSighting } from "@/domain/sightings/compact";
import type { HabitatCollection } from "./habitats";
import { buildStyle } from "./style";

// Bundled, MapLibre cannot locate its worker from import.meta.url; this makes the bundler emit and serve it
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

export type MapStatus = "ready" | "error";

export type MapHandle = {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
};

type Padding = { top: number; right: number; bottom: number; left: number };

type BaseMapProps = {
  habitats: HabitatCollection;
  // Fixed for the map's life; an empty list leaves the layer out
  sightings?: readonly CompactSighting[];
  labels: { region: string; keyboardHelp: string };
  padding: Padding;
  onStatusChange(status: MapStatus): void;
  ref?: Ref<MapHandle>;
};

// Read at call time so a change in the OS setting applies without remounting
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BaseMap({ habitats, sightings, labels, padding, onStatusChange, ref }: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const helpId = useId();

  const reportStatus = useEffectEvent((status: MapStatus) => onStatusChange(status));

  // Reads the props of the first render; later changes go through their own effects
  const createMap = useEffectEvent(
    (container: HTMLDivElement) =>
      new MapLibreMap({
        container,
        style: buildStyle(readMapColors(), habitats, sightings),
        bounds: ARGENTINA_BOUNDS,
        // Absolute so the fit also sets the map padding and the padding effect starts as a no-op
        fitBoundsOptions: { padding, absolutePadding: true },
        maxBounds: MAX_BOUNDS,
        minZoom: MIN_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        locale: { "Map.Title": labels.region },
      }),
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      map = createMap(container);
    } catch {
      // The constructor throws when it cannot get a WebGL context, before any listener exists
      reportStatus("error");
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();

    // The surrounding section is the landmark; the canvas is the interactive widget inside it
    const canvas = map.getCanvas();
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-describedby", helpId);

    const writeZoom = () => container.setAttribute("data-zoom", map.getZoom().toFixed(1));

    let loaded = false;
    // MapLibre still fires load after a failed style or source, so a startup error stays until retry
    let failed = false;
    map.on("load", () => {
      loaded = true;
      writeZoom();
      if (!failed) reportStatus("ready");
    });
    // Only a style or source failure before load breaks the map; after load, or for a single tile
    // (its event carries `tile`), MapLibre retries and the map stays usable
    map.on("error", (event) => {
      if (loaded || "tile" in event) return;
      failed = true;
      reportStatus("error");
    });
    map.on("webglcontextlost", () => reportStatus("error"));
    // MapLibre restores the context itself, and a worker pool restart fires a lost/restored pair
    map.on("webglcontextrestored", () => {
      if (loaded && !failed) reportStatus("ready");
    });
    map.on("zoomend", writeZoom);

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [helpId]);

  const { top, right, bottom, left } = padding;
  useEffect(() => {
    mapRef.current?.setPadding({ top, right, bottom, left });
  }, [top, right, bottom, left]);

  useImperativeHandle(ref, () => {
    function zoomBy(delta: number) {
      const map = mapRef.current;
      if (!map) return;
      const zoom = map.getZoom() + delta;
      if (prefersReducedMotion()) map.jumpTo({ zoom });
      else map.easeTo({ zoom });
    }
    return {
      zoomIn: () => zoomBy(1),
      zoomOut: () => zoomBy(-1),
      resetView: () => {
        mapRef.current?.fitBounds(ARGENTINA_BOUNDS, { animate: !prefersReducedMotion() });
      },
    };
  }, []);

  return (
    <>
      {/* MapLibre owns the container's children, so the help lives beside it.
          Sized, not positioned: MapLibre's unlayered .maplibregl-map forces position: relative over Tailwind's layer */}
      <div ref={containerRef} data-map className="size-full bg-map-sea" />
      <p id={helpId} className="sr-only">
        {labels.keyboardHelp}
      </p>
    </>
  );
}
