"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FencePicker } from "@/components/sweep/fence-picker";
import { SweepReading } from "@/components/sweep/sweep-reading";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { FENCES } from "@/data/fences";
import { spriteUrl } from "@/features/catalog/sprite";
import { openCreature } from "@/features/creature/history";
import { prefetchCreature } from "@/features/creature/use-creature";
import type { SightingsPayload } from "@/features/sweep/types";
import { useFenceSweep } from "@/features/sweep/use-fence-sweep";
import { useResolved } from "@/hooks/use-resolved";
import type { MapHandle, MapStatus, SweepCreature, SweepProps } from "@/map/base-map";
import { supportsWebGL2 } from "@/map/supports-webgl2";
import { CreatureRoute, preloadCreaturePanel } from "./creature-route";
import { HabitatLegend } from "./habitat-legend";

// The notices come from MapStage, so the chunk shows nothing while it downloads.
// HabitatMap carries the habitat data, so it rides in this deferred chunk instead of the initial JS
const BaseMap = dynamic(() => import("./habitat-map").then((m) => m.HabitatMap), {
  ssr: false,
  loading: () => null,
});

const SLOW_MS = 8_000;
const TIMEOUT_MS = 30_000;

// Module constants keep their identity, so BaseMap only reacts to a real change
// Narrow bottom = legend row (44) + gap (8) + controls (44) + gap (8) + attribution wrapped to two lines (88) + margin,
// so Tierra del Fuego stays clear
// + the fence row (44 + 8) and its one-line reading (20 + 8)
const PADDING_NARROW = { top: 64, right: 12, bottom: 284, left: 12 };
// Left clears the sweep panel (320 wide at 12 from the edge)
const PADDING_WIDE = { top: 96, right: 120, bottom: 72, left: 352 };

// A chosen fence also shows its row of creatures (44 + 8) on phones
const FENCE_PADDING_NARROW = { ...PADDING_NARROW, bottom: PADDING_NARROW.bottom + 52 };
// The detail: a 360 px panel at 12 from the right edge on desktop
const DETAIL_RIGHT = 396;
// On phones a sheet up to 60 % tall, lifted over the attribution (two lines of 44)
const SHEET_SHARE = 0.6;
const ATTRIBUTION_HEIGHT = 88;

function detailPadding(wide: boolean) {
  if (wide) return { ...PADDING_WIDE, right: DETAIL_RIGHT };
  return { ...PADDING_NARROW, bottom: Math.round(window.innerHeight * SHEET_SHARE) + ATTRIBUTION_HEIGHT };
}

function fencePadding(wide: boolean, detailOpen: boolean) {
  if (detailOpen) return detailPadding(wide);
  return wide ? PADDING_WIDE : FENCE_PADDING_NARROW;
}

// Hover or focus on a creature: fetch its detail and the panel's code before the tap
function prepareCreature(id: number) {
  preloadCreaturePanel();
  prefetchCreature(id);
}

// Touch has no hover: once the map is up and the browser idle, the panel's code comes anyway
function whenIdle(task: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(task);
    return () => window.cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 1);
  return () => clearTimeout(handle);
}

const WIDE_QUERY = "(min-width: 768px)";

const ICON_PLUS = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 4v12M4 10h12" />
  </svg>
);

const ICON_MINUS = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 10h12" />
  </svg>
);

function subscribeNothing() {
  return () => {};
}

// null until hydrated: the server cannot know, so it renders the loading state
function useWebGL2Support(): boolean | null {
  return useSyncExternalStore(subscribeNothing, supportsWebGL2, () => null);
}

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useWideViewport(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

type Phase = "loading" | "slow" | "ready" | "error" | "offline";

function failure(): Phase {
  return navigator.onLine === false ? "offline" : "error";
}

// Sightings stream with the page; the map never waits for them (the catalog may be slow or down).
// null when the catalog failed
export function MapStage({ sightings: pending }: { sightings?: Promise<SightingsPayload | null> }) {
  const payload = useResolved(pending);
  const t = useTranslations("Map");
  const tFences = useTranslations("Fences");
  const tSweep = useTranslations("Sweep");
  const supported = useWebGL2Support();
  const wide = useWideViewport();
  const online = useOnline();
  const mapRef = useRef<MapHandle>(null);
  const regionRef = useRef<HTMLElement>(null);
  const [key, setKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const { fence, detection, choose } = useFenceSweep(FENCES, payload);
  // The creature open in the detail, as the URL says
  const [focus, setFocus] = useState<number | null>(null);

  const creatures = useMemo(
    (): readonly SweepCreature[] =>
      detection.status === "ready"
        ? detection.traced.map(({ id, name, point }) => ({
            id,
            point,
            label: tSweep("view", { name }),
            sprite: spriteUrl(id),
          }))
        : [],
    [detection, tSweep],
  );

  const mounted = supported === true;
  const waiting = phase === "loading" || phase === "slow";

  useEffect(() => {
    if (phase === "ready") return whenIdle(preloadCreaturePanel);
  }, [phase]);

  // Restarts with each mounted map (retry changes key) and stops once the map settles
  useEffect(() => {
    if (!mounted || !waiting) return;
    const slow = setTimeout(() => setPhase((p) => (p === "loading" ? "slow" : p)), SLOW_MS);
    // Functional: a ready report queued in the same tick must not be overwritten
    const timeout = setTimeout(
      () => setPhase((p) => (p === "loading" || p === "slow" ? failure() : p)),
      TIMEOUT_MS,
    );
    return () => {
      clearTimeout(slow);
      clearTimeout(timeout);
    };
  }, [mounted, waiting, key]);

  // Idempotent: BaseMap may repeat "error", and reports "ready" again after a restored context
  function handleStatus(status: MapStatus) {
    setPhase(status === "ready" ? "ready" : failure());
  }

  function retry() {
    // The focused retry button unmounts with the error; the region outlives every state
    regionRef.current?.focus({ preventScroll: true });
    setKey((k) => k + 1);
    setPhase("loading");
  }

  const visible =
    supported === null
      ? "loading"
      : !supported
        ? "unsupported"
        : waiting && !online
          ? "offline"
          : phase;
  const ready = visible === "ready";

  const sweep: SweepProps = {
    fence,
    creatures,
    focus,
    fencePadding: () => fencePadding(wide, focus !== null),
    detailPadding: () => detailPadding(wide),
    onSelect: openCreature,
    onIntent: prepareCreature,
  };

  // Keyed per state so an alert is inserted fresh (and announced) instead of mutating the status node
  const notice =
    visible === "loading" || visible === "slow" ? (
      <Notice key="loading" variant="info" title={visible === "slow" ? t("slow") : t("loading")} />
    ) : visible === "error" ? (
      <Notice key="error" variant="error" title={t("errorTitle")} action={{ label: t("retry"), onActivate: retry }}>
        {t("errorBody")}
      </Notice>
    ) : visible === "offline" ? (
      <Notice
        key="offline"
        variant="error"
        title={t("offlineTitle")}
        action={{ label: t("retry"), onActivate: retry }}
      >
        {t("offlineBody")}
      </Notice>
    ) : visible === "unsupported" ? (
      <Notice key="unsupported" variant="info" title={t("unsupportedTitle")}>
        {t("unsupportedBody")}
      </Notice>
    ) : null;

  // Flow order inside the page's bottom column: notice above the controls, so it never pushes them
  return (
    <>
      {/* Focusable only from code (retry); the inset ring matches the canvas so it is not clipped */}
      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label={t("region")}
        aria-busy={!ready}
        className="pointer-events-auto absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        {mounted ? (
          <BaseMap
            key={key}
            ref={mapRef}
            sightings={payload?.sightings}
            sweep={sweep}
            labels={{ region: t("region"), keyboardHelp: t("keyboardHelp") }}
            padding={wide ? PADDING_WIDE : PADDING_NARROW}
            onStatusChange={handleStatus}
          />
        ) : null}
      </section>
      {notice ? <div className="pointer-events-auto relative w-full max-w-md self-center">{notice}</div> : null}
      {/* Above the controls on phones; a floating panel at the left on desktop. Usable without the map:
          the list opens the detail even where WebGL is missing */}
      <div className="pointer-events-auto relative flex w-full flex-col-reverse gap-3 rounded-panel border border-structure bg-surface p-2 md:absolute md:top-24 md:left-[max(0.75rem,env(safe-area-inset-left))] md:max-h-[calc(100dvh-12.5rem)] md:w-80 md:flex-col md:overflow-y-auto md:p-3">
        <FencePicker
          fences={FENCES.map(({ id }) => ({ id, name: tFences(id) }))}
          active={fence?.id ?? null}
          onChoose={choose}
        />
        <SweepReading
          detection={detection}
          fenceName={fence ? tFences(fence.id) : null}
          onOpen={openCreature}
          onIntent={prepareCreature}
          onRetry={() => window.location.reload()}
        />
      </div>
      {/* Kept while support is unknown so hydration does not shift the column; gone once the map can never load */}
      {supported === false ? null : (
        // Legend left, controls right: the same order on screen and for the keyboard.
        // On phones they do not fit side by side: the legend keeps the first line and the controls wrap below
        <div className="flex w-full flex-wrap items-end justify-between gap-2">
          <HabitatLegend disabled={!ready} />
          <nav aria-label={t("controls")} className="pointer-events-auto relative ml-auto flex shrink-0 gap-2">
          <Button
            variant="secondary"
            aria-label={t("zoomIn")}
            disabled={!ready}
            onClick={() => mapRef.current?.zoomIn()}
            className="px-0!"
          >
            {ICON_PLUS}
          </Button>
          <Button
            variant="secondary"
            aria-label={t("zoomOut")}
            disabled={!ready}
            onClick={() => mapRef.current?.zoomOut()}
            className="px-0!"
          >
            {ICON_MINUS}
          </Button>
          <Button variant="secondary" disabled={!ready} onClick={() => mapRef.current?.resetView()}>
            {t("reset")}
          </Button>
          </nav>
        </div>
      )}
      {/* Its own boundary: reading the URL must not keep the map and its controls out of the prerender.
          Independent of the map's phase, so the detail shows even when the map cannot load */}
      <Suspense fallback={null}>
        <CreatureRoute wide={wide} fallbackFocus={() => regionRef.current} onChange={setFocus} />
      </Suspense>
    </>
  );
}
