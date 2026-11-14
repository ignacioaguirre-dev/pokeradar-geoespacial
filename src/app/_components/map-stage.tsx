"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { FencePicker } from "@/components/sweep/fence-picker";
import { SweepReading } from "@/components/sweep/sweep-reading";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { FENCES } from "@/data/fences";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { spriteUrl } from "@/features/catalog/sprite";
import { CREATURE_PARAM, openCreature, parseCreatureId } from "@/features/creature/history";
import { useOnline } from "@/hooks/use-online";
import {
  getSnapshot as hasSeenMapHelp,
  markMapHelpSeen,
  subscribe as subscribeMapHelp,
} from "@/features/map-help/storage";
import type { SightingsPayload } from "@/features/sweep/types";
import { OWN_FENCE_ID, useFenceSweep } from "@/features/sweep/use-fence-sweep";
import { usePointerKind } from "@/hooks/use-pointer-kind";
import { useResolved } from "@/hooks/use-resolved";
import type { MapHandle, MapInput, MapStatus, SweepCreature, SweepProps } from "@/map/base-map";
import { supportsWebGL2 } from "@/map/supports-webgl2";
import { CreatureRoute, preloadCreaturePanel } from "./creature-route";
import type { FenceDrawingHandle } from "./fence-drawing";
import { FenceDrawing, FenceDrawingTrigger, preloadFenceDrawing } from "./fence-drawing-entry";
import { introPlayed } from "./intro-played";
import { LoadBoundary, useLazyWhenOnline } from "./load-when-online";
import { introLines, type MapHelpButtonHandle, MapHelpIntro, panelLines } from "./map-help";

// The notices come from MapStage, so the chunk shows nothing while it downloads (or fails).
// HabitatMap carries the habitat data, so it rides in this deferred chunk instead of the initial JS
const loadMap = () => import("./habitat-map").then((m) => m.HabitatMap);

// The controls wait for the map anyway, so each layout comes in its own chunk, into room already kept for it
const ControlColumn = dynamic(() => import("./control-column").then((m) => m.ControlColumn), {
  ssr: false,
  loading: () => null,
});
const ControlRow = dynamic(() => import("./control-row").then((m) => m.ControlRow), {
  ssr: false,
  loading: () => null,
});

const SLOW_MS = 8_000;
const TIMEOUT_MS = 30_000;

// Module constants keep their identity, so BaseMap only reacts to a real change
// Narrow bottom = the folded attribution (44) + gap (8) + the sweep panel: its fence row (44), one-line reading (20),
// their gap (12), padding and border (18) + margin, so Tierra del Fuego stays clear.
// Right = the control column (44 at 12 from the edge) + a gap
const PADDING_NARROW = { top: 64, right: 68, bottom: 160, left: 12 };
// Left clears the sweep panel (320 wide at 12 from the edge)
const PADDING_WIDE = { top: 96, right: 120, bottom: 72, left: 352 };

// A chosen fence also shows its row of creatures (44 + 8) on phones
const FENCE_PADDING_NARROW = { ...PADDING_NARROW, bottom: PADDING_NARROW.bottom + 52 };
// The detail: a 360 px panel at 12 from the right edge on desktop
const DETAIL_RIGHT = 396;
// On phones a sheet up to 60 % tall, resting on the folded attribution (44) 8 apart, so it stays in reach
const SHEET_SHARE = 0.6;
const SHEET_BOTTOM = 52;
// The sheet stops this far from the top, however short the screen
const MAP_ABOVE_SHEET = 160;

// Below this, the sweep panel and the detail would leave the creature a sliver between them
const MIN_VIEW_WIDTH = 320;

function detailPadding(wide: boolean) {
  if (wide) {
    const roomy = window.innerWidth - PADDING_WIDE.left - DETAIL_RIGHT >= MIN_VIEW_WIDTH;
    // Narrow desktops: the creature may sit under the sweep panel rather than vanish between the two
    return { ...PADDING_WIDE, right: DETAIL_RIGHT, left: roomy ? PADDING_WIDE.left : PADDING_NARROW.left };
  }
  const sheet = Math.round(window.innerHeight * SHEET_SHARE) + SHEET_BOTTOM;
  return { ...PADDING_NARROW, bottom: Math.min(sheet, window.innerHeight - MAP_ABOVE_SHEET) };
}

// Clear space kept between the lowest marker and the sweep panel
const PANEL_GAP = 12;

// On phones the sweep panel sits over the bottom of the map and grows with its reading (up to three lines),
// so the fence is framed above the panel as measured, never above a guess
function fencePadding(wide: boolean, detailOpen: boolean, panel: HTMLElement | null) {
  if (detailOpen) return detailPadding(wide);
  if (wide) return PADDING_WIDE;
  const rect = panel?.getBoundingClientRect();
  if (!rect || rect.height === 0) return FENCE_PADDING_NARROW;
  const below = Math.round(window.innerHeight - rect.top) + PANEL_GAP;
  return { ...FENCE_PADDING_NARROW, bottom: Math.max(FENCE_PADDING_NARROW.bottom, below) };
}

// Hover or focus on a creature: fetch its detail and the panel's code before the tap.
// Imported on demand so the detail's fetching code stays out of the initial JS; one module, one cache
function prepareCreature(id: number) {
  preloadCreaturePanel();
  void import("@/features/creature/use-creature").then((m) => m.prefetchCreature(id));
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

// The movement help opens from the left edge; on desktop it clears the sweep panel (20rem + the 0.5rem gap)
const HELP_LEFT = "left-0 md:left-[20.5rem]";
// One line per input where it fits, so the intro stays low and leaves the middle of the map clear.
// 45rem keeps it off the detail panel (360 px at 12 from the right) on wide desktops
const INTRO_WIDE = "md:w-max md:max-w-[max(24rem,calc(100vw-45rem))]";

const WIDE_QUERY = "(min-width: 768px)";
// Wide enough for the help beside the sweep panel (20.5rem + 24rem) and the detail (360 px at 12) to fit side by side
const ROOMY_QUERY = "(min-width: 1120px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeNothing() {
  return () => {};
}

// null until hydrated: the server cannot know, so it renders the loading state
function useWebGL2Support(): boolean | null {
  return useSyncExternalStore(subscribeNothing, supportsWebGL2, () => null);
}

function subscribeMedia(media: string, onChange: () => void) {
  const query = window.matchMedia(media);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const subscribeWide = (onChange: () => void) => subscribeMedia(WIDE_QUERY, onChange);
const subscribeRoomy = (onChange: () => void) => subscribeMedia(ROOMY_QUERY, onChange);

function useWideViewport(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

function useRoomyViewport(): boolean {
  return useSyncExternalStore(
    subscribeRoomy,
    () => window.matchMedia(ROOMY_QUERY).matches,
    () => false,
  );
}

// The server cannot read storage, so it renders as seen and the intro only appears after hydration.
// The store is the single source of truth: dismissing writes there and every reader follows
function useHelpSeen(): boolean {
  return useSyncExternalStore(subscribeMapHelp, hasSeenMapHelp, () => true);
}
// A shared creature link lands on its detail, whose desktop panel would also cover the skip button
function shouldFly(): boolean {
  if (introPlayed.current || window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
  return parseCreatureId(new URLSearchParams(window.location.search).get(CREATURE_PARAM)) === null;
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
  const tDrawing = useTranslations("FenceDrawing");
  const supported = useWebGL2Support();
  const wide = useWideViewport();
  const roomy = useRoomyViewport();
  const online = useOnline();
  const [BaseMap, reloadMap] = useLazyWhenOnline(loadMap);
  const pointer = usePointerKind();
  const helpSeen = useHelpSeen();
  // A ref, not state: it changes mid-gesture and is only read when the help panel opens
  const detectedRef = useRef<MapInput | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const helpRef = useRef<MapHelpButtonHandle>(null);
  const columnRef = useRef<HTMLElement>(null);
  const regionRef = useRef<HTMLElement>(null);
  const sweepPanelRef = useRef<HTMLDivElement>(null);
  const { fence, detection, choose, draw } = useFenceSweep(FENCES, payload);
  // The vertices of the fence being drawn; null outside the drawing mode
  const [draft, setDraft] = useState<Ring | null>(null);
  const drawingRef = useRef<FenceDrawingHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Leaving the mode unmounts its focused buttons: the trigger, back in their place, takes the focus
  const returnFocus = useRef(false);
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

  // Sprites start loading as soon as the creatures are known, not when their markers land a second later
  useEffect(() => {
    for (const { sprite } of creatures) preload(sprite, { as: "image", crossOrigin: "anonymous" });
  }, [creatures]);

  const noticeRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  // The server cannot read the motion setting and decides false; everything that depends on it waits for
  // `mounted`, which is null during hydration, so both renders agree
  const [intro] = useState(() => typeof window !== "undefined" && shouldFly());
  const [introDone, setIntroDone] = useState(false);
  // Only the first map flies: a retry or a reconnect remount already lost the moment
  const flies = intro && key === 0;

  const mounted = supported === true;
  const waiting = phase === "loading" || phase === "slow";

  useEffect(() => {
    if (phase !== "ready") return;
    return whenIdle(() => {
      preloadCreaturePanel();
      preloadFenceDrawing();
    });
  }, [phase]);

  useEffect(() => {
    if (draft !== null || !returnFocus.current) return;
    returnFocus.current = false;
    triggerRef.current?.focus();
  }, [draft]);

  // Marked as soon as the flight can start: a remount (leaving the page and coming back) lands directly
  useEffect(() => {
    if (mounted && flies) introPlayed.current = true;
  }, [mounted, flies]);

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
    restart();
  }

  function restart() {
    reloadMap();
    setKey((k) => k + 1);
    setPhase("loading");
  }

  // Reconnecting remounts a failed map; focus moves only if it sat on the retry that goes away with the error
  const failed = phase === "error" || phase === "offline";
  const reconnect = useEffectEvent(() => {
    if (noticeRef.current?.contains(document.activeElement)) regionRef.current?.focus({ preventScroll: true });
    restart();
  });
  useEffect(() => {
    if (!failed) return;
    const onOnline = () => reconnect();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [failed]);

  const visible =
    supported === null
      ? "loading"
      : !supported
        ? "unsupported"
        : waiting && !online
          ? "offline"
          : phase;
  const ready = visible === "ready";
  // Hidden on any failure: the notice and its retry take over
  const flying = mounted && flies && !introDone && (visible === "loading" || visible === "slow" || ready);
  // The map is ready while it flies, but its controls wait for the final frame
  const interactive = ready && !flying;
  // On a phone the detail is a bottom sheet: the control column steps aside until it closes, and the help with it.
  // On a narrow desktop the help beside the sweep panel would run under the detail, so it waits too.
  // It also waits for the flight: it explains how to move a map the person cannot move yet
  const sheetOver = focus !== null && !wide;
  const helpCovered = focus !== null && !roomy;
  const showHelp = interactive && pointer !== null && !helpSeen && !helpCovered;

  // Remembered even when storage fails: then it only lasts until the page reloads
  function dismissHelp() {
    if (!showHelp) return;
    markMapHelpSeen();
  }

  // The first move of the map closes whichever help is showing, the intro or the panel
  function handleInteract() {
    dismissHelp();
    helpRef.current?.close();
  }

  function handleCreatureChange(id: number | null) {
    setFocus(id);
    if (id !== null && !roomy) helpRef.current?.close();
  }

  function handleInputDetected(input: MapInput) {
    detectedRef.current = input;
  }

  function acknowledgeHelp() {
    dismissHelp();
    // The focused Entendido unmounts; the help button is where this help lives from now on
    if (wide) helpRef.current?.focus();
    else columnRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
  }

  function endIntro() {
    // The skip button unmounts with the flight; the map is where the user was heading
    if (skipRef.current?.contains(document.activeElement)) focusMap();
    setIntroDone(true);
  }

  function focusMap() {
    // Before its chunk arrives there is no map yet, only the region that will hold it
    if (mapRef.current) mapRef.current.focus();
    else regionRef.current?.focus({ preventScroll: true });
  }

  function skipIntro() {
    // Also covers a skip before the map exists: it is then created without a flight
    setIntroDone(true);
    mapRef.current?.skipIntro();
    focusMap();
  }

  function startDrawing() {
    helpRef.current?.close();
    setDraft([]);
  }

  function leaveDrawing() {
    returnFocus.current = true;
    setDraft(null);
  }

  function closeDrawing(ring: Ring) {
    draw(ring);
    leaveDrawing();
  }

  // The map reports where; the panel decides whether the rules let it become a vertex
  function handleDraftPoint(point: LngLat) {
    drawingRef.current?.add(point);
  }

  // A map that fails mid-drawing hides the mode with it; the vertices wait for the retry
  const drawing = draft !== null && interactive;

  const sweep: SweepProps = {
    // Only once there is something to trace: rings over a fence still loading would play twice, or for nothing.
    // Cleared while drawing, so the fence in progress is the only one on the map
    fence: detection.status === "ready" && !drawing ? fence : null,
    creatures,
    focus,
    fencePadding: () => fencePadding(wide, focus !== null, sweepPanelRef.current),
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
        title={t("errorTitle")}
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
      {flying ? (
        // Top right, away from the brand and the bottom controls, where a skip is expected.
        // First in the DOM, so it is also the first Tab stop while the flight runs
        <div
          ref={skipRef}
          className="pointer-events-auto absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10"
        >
          <Button variant="secondary" aria-label={t("skipIntroLabel")} onClick={skipIntro} className="px-4!">
            {t("skipIntro")}
          </Button>
        </div>
      ) : null}
      {/* Focusable only from code (retry); the inset ring matches the canvas so it is not clipped */}
      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label={t("region")}
        aria-busy={!ready}
        className="pointer-events-auto absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        {mounted ? (
          <LoadBoundary key={key} fallback={null} onError={() => setPhase(failure())}>
            <BaseMap
              ref={mapRef}
              sightings={payload?.sightings}
              sweep={sweep}
              draft={drawing ? { ring: draft, onPoint: handleDraftPoint } : null}
              labels={{ region: t("region"), keyboardHelp: drawing ? tDrawing("keyboardHelp") : t("keyboardHelp") }}
              padding={wide ? PADDING_WIDE : PADDING_NARROW}
              intro={flies && !introDone}
              onIntroEnd={endIntro}
              onStatusChange={handleStatus}
              onInputDetected={handleInputDetected}
              onInteract={handleInteract}
            />
          </LoadBoundary>
        ) : null}
      </section>
      {notice ? (
        <div ref={noticeRef} className="pointer-events-auto relative w-full max-w-md self-center">
          {notice}
        </div>
      ) : null}
      {/* From md it is no box at all: the sweep panel floats and the controls row anchors the help */}
      <div className="relative flex w-full flex-col gap-2 md:contents">
        {/* Across the bottom on phones; a floating panel at the left on desktop. Usable without the map:
            the list opens the detail even where WebGL is missing. Fences first, then what they found:
            seen in the order the keyboard reaches them. Choosing a fence is a first interaction too: the
            intro would otherwise sit over the creatures it brings */}
        <div
          ref={sweepPanelRef}
          onClickCapture={dismissHelp}
          className="pointer-events-auto relative flex w-full flex-col gap-3 rounded-panel border border-structure bg-surface p-2 md:absolute md:top-24 md:left-[max(0.75rem,env(safe-area-inset-left))] md:max-h-[calc(100dvh-12.5rem)] md:w-80 md:overflow-y-auto md:p-3">
          {drawing ? (
            <FenceDrawing
              ref={drawingRef}
              vertices={draft}
              onChange={setDraft}
              onClose={closeDrawing}
              onCancel={leaveDrawing}
              reticlePoint={() => mapRef.current?.reticlePoint() ?? null}
            />
          ) : (
            <>
              <FencePicker
                fences={FENCES.map(({ id }) => ({ id, name: tFences(id) }))}
                active={fence?.id ?? null}
                // Like the map controls it waits for the final frame, yet without a flight it works before the map does
                // (the list opens the detail even without WebGL). The map itself ends a flight a sweep would land over
                disabled={flying}
                // Drawing needs the map, settled
                lead={<FenceDrawingTrigger ref={triggerRef} disabled={!interactive} onStart={startDrawing} />}
                onChoose={choose}
              />
              <SweepReading
                detection={detection}
                fenceName={fence ? (fence.id === OWN_FENCE_ID ? tDrawing("own") : tFences(fence.id)) : null}
                onOpen={openCreature}
                onIntent={prepareCreature}
                onRetry={() => window.location.reload()}
              />
            </>
          )}
        </div>
        {/* The row's room is kept from the server on, so its controls land without shifting the column; gone once the
            map can never load. Using any control counts as the first interaction, so it also closes the intro */}
        {supported === false ? null : (
          <div
            className="flex w-full items-end justify-between gap-2 max-md:hidden md:relative md:min-h-11"
            onClickCapture={dismissHelp}
          >
            {/* Floats above the controls instead of joining the column, which would grow upward as a layout shift */}
            {showHelp && wide ? (
              // Left, by the help button: the right side belongs to the creature detail
              <div className={`pointer-events-auto absolute bottom-full mb-2 w-full max-w-sm ${HELP_LEFT} ${INTRO_WIDE}`}>
                <MapHelpIntro lines={introLines(pointer)} onDismiss={acknowledgeHelp} />
              </div>
            ) : null}
            {wide ? (
              <ControlRow
                helpRef={helpRef}
                disabled={!interactive}
                onZoomIn={() => mapRef.current?.zoomIn()}
                onZoomOut={() => mapRef.current?.zoomOut()}
                onReset={() => mapRef.current?.resetView()}
                helpLines={() => panelLines(pointer, detectedRef.current)}
                // Reopened beside a detail that leaves no room, it rises over the sweep panel instead
                helpPanelClassName={helpCovered ? "left-0" : HELP_LEFT}
              />
            ) : null}
          </div>
        )}
      </div>
      {/* Phones: the free map above the sweep panel, with the control column centred at its right edge.
          After the panel in the DOM, so the keyboard reaches the fences and the reading first; first on screen */}
      {supported === false ? null : (
        // Any of its buttons counts as the first interaction, so it also closes the intro
        <div
          className="order-first flex min-h-0 w-full flex-1 items-center justify-end pt-16 md:hidden"
          onClickCapture={dismissHelp}
        >
          {/* Out of the way while the detail sheet is up; the map itself still pinches and drags */}
          {wide || sheetOver ? null : (
            <ControlColumn
              ref={columnRef}
              disabled={!interactive}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onReset={() => mapRef.current?.resetView()}
              helpLines={() => panelLines(pointer, detectedRef.current)}
              intro={
                showHelp ? <MapHelpIntro lines={introLines(pointer)} onDismiss={acknowledgeHelp} stacked /> : null
              }
            />
          )}
        </div>
      )}
      {/* Its own boundary: reading the URL must not keep the map and its controls out of the prerender.
          Independent of the map's phase, so the detail shows even when the map cannot load */}
      <Suspense fallback={null}>
        <CreatureRoute wide={wide} fallbackFocus={() => regionRef.current} onChange={handleCreatureChange} />
      </Suspense>
    </>
  );
}
