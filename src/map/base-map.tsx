"use client";

// Static on purpose: next/dynamic already defers this whole file, so import() here would chain a second download
import { type GeoJSONSource, Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Ref, useEffect, useEffectEvent, useId, useImperativeHandle, useRef, useState } from "react";
import { ARGENTINA_BOUNDS, MAX_BOUNDS, MIN_ZOOM } from "./argentina";
import { readMapColors } from "./colors";
import type { CompactSighting } from "@/domain/sightings/compact";
import type { HabitatCollection } from "./habitats";
import { SIGHTINGS_SOURCE, toSightingCollection } from "./sightings";
import { INTRO_PROJECTION, type IntroFlight, startIntroFlight } from "./intro-flight";
import { buildStyle } from "./style";
import type { LngLat } from "@/domain/geometry/types";
import { CONTROL_MOVE } from "./sweep";
import { type FenceDraftProps, reticlePoint, useFenceDraft } from "./use-fence-draft";
import { type SweepProps, useSweep } from "./use-sweep";
import { type GestureState, classifyWheel, toPixels, wheelAction, wheelZoomDelta } from "./wheel-gesture";

export type { SweepCreature, SweepFence, SweepProps } from "./use-sweep";
export type { FenceDraftProps } from "./use-fence-draft";

// Bundled, MapLibre cannot locate its worker from import.meta.url; this makes the bundler emit and serve it
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

export type MapStatus = "ready" | "error";

// What the person moves the map with, as far as the events tell
export type MapInput = "touch" | "touchpad" | "mouse";

export type MapHandle = {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  skipIntro(): void;
  focus(): void;
  // Where the drawing reticle points; null before the map exists
  reticlePoint(): LngLat | null;
};

type Padding = { top: number; right: number; bottom: number; left: number };

type BaseMapProps = {
  habitats: HabitatCollection;
  // May arrive after the map was created (streamed with the page); until then the layer is empty
  sightings?: readonly CompactSighting[];
  labels: { region: string; keyboardHelp: string };
  padding: Padding;
  // The chosen fence and what it detected; the sweep logic lives in ./use-sweep
  sweep?: SweepProps;
  // Set while the person draws their own fence: taps and Enter become points, and the reticle shows
  draft?: FenceDraftProps | null;
  // Read when the map is created: fly in from space instead of opening on the final frame.
  // Later it only keeps the space background behind the globe until the page reports the flight over
  intro?: boolean;
  onIntroEnd?(): void;
  onStatusChange(status: MapStatus): void;
  onInputDetected?(input: MapInput): void;
  // The person moved or zoomed the map (moves made from code do not count)
  onInteract?(): void;
  ref?: Ref<MapHandle>;
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DOM_DELTA_PAGE = 2;

export function BaseMap({
  habitats,
  sightings,
  labels,
  padding,
  sweep,
  draft,
  intro = false,
  onIntroEnd,
  onStatusChange,
  onInputDetected,
  onInteract,
  ref,
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const flightRef = useRef<IntroFlight | null>(null);
  const helpId = useId();
  // The sightings the map's source holds, so a re-render with the same list does not reload it
  const appliedSightings = useRef<readonly CompactSighting[] | undefined>(undefined);
  // Set once the style loads: the sweep draws on sources that exist only from then on
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);
  // One list per map, read at call time: its matches follows the OS setting without remounting
  const reducedMotionRef = useRef<MediaQueryList | null>(null);

  const reportStatus = useEffectEvent((status: MapStatus) => onStatusChange(status));
  const reportInput = useEffectEvent((input: MapInput) => onInputDetected?.(input));
  const reportInteraction = useEffectEvent(() => onInteract?.());
  const reportIntroEnd = useEffectEvent(() => onIntroEnd?.());

  // Reads the props of the first render; later changes go through their own effects
  const createMap = useEffectEvent((container: HTMLDivElement) => {
    appliedSightings.current = sightings;
    return new MapLibreMap({
        container,
        style: buildStyle(readMapColors(), habitats, sightings, intro ? INTRO_PROJECTION : undefined),
        bounds: ARGENTINA_BOUNDS,
        // Absolute so the fit also sets the map padding and the padding effect starts as a no-op
        fitBoundsOptions: { padding, absolutePadding: true },
        maxBounds: MAX_BOUNDS,
        minZoom: MIN_ZOOM,
        // The map idles between moves. Without the last frame kept, Chrome repaints a hovered control or marker
        // over an emptied buffer and that rectangle of the map shows the background instead
        canvasContextAttributes: { preserveDrawingBuffer: true },
        // Its handler reads every wheel as zoom; the wheel listener below pans touchpad swipes instead
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        locale: { "Map.Title": labels.region },
    });
  });

  // Reads the first render's intro, like createMap; the map must already sit on the final frame
  const startFlight = useEffectEvent((map: MapLibreMap, container: HTMLDivElement) => {
    if (!intro) return null;
    return startIntroFlight(map, {
      width: container.clientWidth,
      height: container.clientHeight,
      rimColor: readMapColors().coast,
      onEnd: () => reportIntroEnd(),
    });
  });

  // Sources exist only once the style loaded; before that, the load handler calls this again
  const syncSightings = useEffectEvent(() => {
    if (sightings === appliedSightings.current) return;
    const source = mapRef.current?.getSource<GeoJSONSource>(SIGHTINGS_SOURCE);
    if (!source) return;
    source.setData(toSightingCollection(sightings ?? []));
    appliedSightings.current = sightings;
  });

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
    const reducedMotion = window.matchMedia(REDUCED_MOTION);
    reducedMotionRef.current = reducedMotion;

    // The surrounding section is the landmark; the canvas is the interactive widget inside it
    const canvas = map.getCanvas();
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-describedby", helpId);

    const writeZoom = () => container.setAttribute("data-zoom", map.getZoom().toFixed(1));

    let loaded = false;
    // MapLibre still fires load after a failed style or source, so a startup error stays until retry
    let failed = false;
    // The notice takes over: a flight left running would start on that late load and draw the globe's rim over it
    const fail = () => {
      flightRef.current?.cancel();
      reportStatus("error");
    };
    map.on("load", () => {
      loaded = true;
      writeZoom();
      syncSightings();
      setLoadedMap(map);
      if (!failed) reportStatus("ready");
    });
    // Only a style or source failure before load breaks the map; after load, or for a single tile
    // (its event carries `tile`), MapLibre retries and the map stays usable
    map.on("error", (event) => {
      if (loaded || "tile" in event) return;
      failed = true;
      fail();
    });
    map.on("webglcontextlost", fail);
    // MapLibre restores the context itself, and a worker pool restart fires a lost/restored pair
    map.on("webglcontextrestored", () => {
      if (loaded && !failed) reportStatus("ready");
    });
    map.on("zoomend", writeZoom);
    flightRef.current = startFlight(map, container);

    // An unanimated touchpad pan ends a move on every wheel event, so the attribute is written once per frame
    let centerFrame = 0;
    const writeCenter = () => {
      centerFrame = 0;
      const { lng, lat } = map.getCenter();
      container.setAttribute("data-center", `${lng.toFixed(2)},${lat.toFixed(2)}`);
    };
    // Where an eased mouse zoom is heading, so ticks during the animation add up instead of restarting it
    let zoomTarget: number | null = null;
    map.on("moveend", () => {
      zoomTarget = null;
      if (centerFrame === 0) centerFrame = requestAnimationFrame(writeCenter);
    });
    // MapLibre's own handlers (drag, touch, keyboard) and the wheel below pass the DOM event along
    map.on("movestart", (event) => {
      if (event.originalEvent) reportInteraction();
    });

    const wheelTarget = map.getCanvasContainer();
    let gesture: GestureState | null = null;
    let reported: MapInput | null = null;
    const report = (input: MapInput) => {
      if (input === reported) return;
      reported = input;
      reportInput(input);
    };
    // A touchpad click is a mouse pointer too, so only a finger is told apart here
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") report("touch");
    };
    const onWheel = (event: WheelEvent) => {
      // The flight's own capture listener usually got here first; ending it again is a no-op, and the wheel
      // must never pan or zoom a camera that is still flying
      flightRef.current?.cancel();
      gesture = classifyWheel(event, gesture, event.timeStamp);
      report(gesture.kind);
      const eventData = { originalEvent: event };
      // Reading the size forces layout, and only page deltas need it
      const height = event.deltaMode === DOM_DELTA_PAGE ? wheelTarget.clientHeight : 0;
      if (wheelAction(event, gesture) === "pan") {
        const [x, y] = toPixels(event, height);
        if (x === 0 && y === 0) return;
        event.preventDefault();
        map.panBy([x, y], { animate: false }, eventData);
        return;
      }
      const delta = wheelZoomDelta(event, height);
      if (delta === 0) return;
      event.preventDefault();
      const rect = wheelTarget.getBoundingClientRect();
      const around = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
      const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), (zoomTarget ?? map.getZoom()) + delta));
      // Mouse ticks are coarse and far apart, so they ease; a pinch streams many small steps that follow the fingers
      const animate = gesture.kind === "mouse" && !reducedMotion.matches;
      map.easeTo({ zoom, around, animate, duration: 200 }, eventData);
      zoomTarget = animate ? zoom : null;
    };
    wheelTarget.addEventListener("wheel", onWheel, { passive: false });
    wheelTarget.addEventListener("pointerdown", onPointerDown);

    return () => {
      cancelAnimationFrame(centerFrame);
      wheelTarget.removeEventListener("wheel", onWheel);
      wheelTarget.removeEventListener("pointerdown", onPointerDown);
      flightRef.current?.dispose();
      flightRef.current = null;
      mapRef.current = null;
      reducedMotionRef.current = null;
      map.remove();
    };
  }, [helpId]);

  useEffect(() => syncSightings(), [sightings]);

  // A sweep moves the camera, so a flight still running ends first instead of snapping back over it
  useSweep(loadedMap, sweep, padding, () => flightRef.current?.cancel());
  const reticleRef = useRef<SVGSVGElement>(null);
  useFenceDraft(loadedMap, draft, reticleRef);

  const { top, right, bottom, left } = padding;
  useEffect(() => {
    mapRef.current?.setPadding({ top, right, bottom, left });
  }, [top, right, bottom, left]);

  useImperativeHandle(ref, () => {
    const prefersReducedMotion = () => reducedMotionRef.current?.matches ?? false;
    function zoomBy(delta: number) {
      const map = mapRef.current;
      if (!map) return;
      const zoom = map.getZoom() + delta;
      if (prefersReducedMotion()) map.jumpTo({ zoom }, CONTROL_MOVE);
      else map.easeTo({ zoom }, CONTROL_MOVE);
    }
    return {
      zoomIn: () => zoomBy(1),
      zoomOut: () => zoomBy(-1),
      // Absolute: a sweep or a creature may have left its own padding on the map
      resetView: () => {
        mapRef.current?.fitBounds(ARGENTINA_BOUNDS, {
          padding: { top, right, bottom, left },
          absolutePadding: true,
          animate: !prefersReducedMotion(),
        }, CONTROL_MOVE);
      },
      skipIntro: () => flightRef.current?.cancel(),
      focus: () => mapRef.current?.getCanvas().focus({ preventScroll: true }),
      reticlePoint: () => (mapRef.current ? reticlePoint(mapRef.current) : null),
    };
  }, [top, right, bottom, left]);

  return (
    <>
      {/* MapLibre owns the container's children, so the help lives beside it.
          Sized, not positioned: MapLibre's unlayered .maplibregl-map forces position: relative over Tailwind's layer */}
      <div ref={containerRef} data-map className={`size-full ${intro ? "bg-map-space" : "bg-map-sea"}`} />
      <p id={helpId} className="sr-only">
        {labels.keyboardHelp}
      </p>
      {draft ? <Reticle ref={reticleRef} /> : null}
    </>
  );
}

// Over the map's center, where reticlePoint reads; useFenceDraft places it and the map moves under it
function Reticle({ ref }: { ref: Ref<SVGSVGElement> }) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      data-reticle
      viewBox="0 0 32 32"
      // Centered on its point by the negative margins, since the translate is the point itself
      className="pointer-events-none invisible absolute top-0 left-0 -mt-4 -ml-4 size-8 text-sweep"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {/* Open in the middle so the spot it marks stays visible */}
      <path d="M16 2v10M16 20v10M2 16h10M20 16h10" />
    </svg>
  );
}
