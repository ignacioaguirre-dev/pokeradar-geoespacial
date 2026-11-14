"use client";

import { useTranslations } from "next-intl";
import { Suspense, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useOnline } from "@/hooks/use-online";
import { usePointerKind } from "@/hooks/use-pointer-kind";
import { useResolved } from "@/hooks/use-resolved";
import type { CompactSighting } from "@/domain/sightings/compact";
import { CREATURE_PARAM, parseCreatureId } from "@/features/creature/history";
import {
  getSnapshot as hasSeenMapHelp,
  markMapHelpSeen,
  subscribe as subscribeMapHelp,
} from "@/features/map-help/storage";
import type { MapHandle, MapInput, MapStatus } from "@/map/base-map";
import { supportsWebGL2 } from "@/map/supports-webgl2";
import { CreatureRoute } from "./creature-route";
import { HabitatLegend } from "./habitat-legend";
import { introPlayed } from "./intro-played";
import { LoadBoundary, useLazyWhenOnline } from "./load-when-online";
import { introLines, MapHelpButton, type MapHelpButtonHandle, MapHelpIntro, panelLines } from "./map-help";

// The notices come from MapStage, so the chunk shows nothing while it downloads (or fails).
// HabitatMap carries the habitat data, so it rides in this deferred chunk instead of the initial JS
const loadMap = () => import("./habitat-map").then((m) => m.HabitatMap);

const SLOW_MS = 8_000;
const TIMEOUT_MS = 30_000;

// Module constants keep their identity, so BaseMap only reacts to a real change
// Narrow bottom = legend row (44) + gap (8) + controls (44) + gap (8) + attribution wrapped to two lines (88) + margin,
// so Tierra del Fuego stays clear
const PADDING_NARROW = { top: 64, right: 12, bottom: 204, left: 12 };
const PADDING_WIDE = { top: 96, right: 120, bottom: 72, left: 120 };

const WIDE_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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

// Sightings stream with the page; the map never waits for them (the catalog may be slow or down)
export function MapStage({ sightings: pending }: { sightings?: Promise<readonly CompactSighting[]> }) {
  const sightings = useResolved(pending);
  const t = useTranslations("Map");
  const supported = useWebGL2Support();
  const wide = useWideViewport();
  const online = useOnline();
  const [BaseMap, reloadMap] = useLazyWhenOnline(loadMap);
  const pointer = usePointerKind();
  const helpSeen = useHelpSeen();
  // A ref, not state: it changes mid-gesture and is only read when the help panel opens
  const detectedRef = useRef<MapInput | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const helpRef = useRef<MapHelpButtonHandle>(null);
  const regionRef = useRef<HTMLElement>(null);
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
  // On a phone the detail is a bottom sheet over the controls row, so the help waits under it until it closes.
  // It also waits for the flight: it explains how to move a map the person cannot move yet
  const sheetOver = detailOpen && !wide;
  const showHelp = interactive && pointer !== null && !helpSeen && !sheetOver;

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

  function handleDetailChange(open: boolean) {
    setDetailOpen(open);
    if (open && !wide) helpRef.current?.close();
  }

  function handleInputDetected(input: MapInput) {
    detectedRef.current = input;
  }

  function acknowledgeHelp() {
    dismissHelp();
    // The focused Entendido unmounts; the help button is where this help lives from now on
    helpRef.current?.focus();
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
              sightings={sightings}
              labels={{ region: t("region"), keyboardHelp: t("keyboardHelp") }}
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
      {/* Kept while support is unknown so hydration does not shift the column; gone once the map can never load */}
      {supported === false ? null : (
        // Legend and help left, controls right: the same order on screen and for the keyboard.
        // On phones they do not fit side by side: the legend keeps the first line and the controls wrap below
        // Using any control counts as the first interaction, so it also closes the intro
        <div className="relative flex w-full flex-wrap items-end justify-between gap-2" onClickCapture={dismissHelp}>
          {/* Floats above the controls instead of joining the column, which would grow upward as a layout shift */}
          {showHelp ? (
            // Left, by the help button: on desktop the right side belongs to the creature detail
            <div className="pointer-events-auto absolute left-0 bottom-full mb-2 w-full max-w-sm">
              <MapHelpIntro lines={introLines(pointer)} onDismiss={acknowledgeHelp} />
            </div>
          ) : null}
          {/* The help button keeps its visible label, which does not fit beside the map controls on a 360 px phone,
              so it rides in the legend's row: both explain the map, the nav moves it */}
          <div className="flex gap-2">
            <HabitatLegend disabled={!interactive} />
            <MapHelpButton
              ref={helpRef}
              lines={() => panelLines(pointer, detectedRef.current)}
              disabled={!interactive}
            />
          </div>
          <nav aria-label={t("controls")} className="pointer-events-auto relative ml-auto flex shrink-0 gap-2">
          <Button
            variant="secondary"
            aria-label={t("zoomIn")}
            disabled={!interactive}
            onClick={() => mapRef.current?.zoomIn()}
            className="px-0!"
          >
            {ICON_PLUS}
          </Button>
          <Button
            variant="secondary"
            aria-label={t("zoomOut")}
            disabled={!interactive}
            onClick={() => mapRef.current?.zoomOut()}
            className="px-0!"
          >
            {ICON_MINUS}
          </Button>
          <Button variant="secondary" disabled={!interactive} onClick={() => mapRef.current?.resetView()}>
            {t("reset")}
          </Button>
          </nav>
        </div>
      )}
      {/* Its own boundary: reading the URL must not keep the map and its controls out of the prerender.
          Independent of the map's phase, so the detail shows even when the map cannot load */}
      <Suspense fallback={null}>
        <CreatureRoute wide={wide} fallbackFocus={() => regionRef.current} onOpenChange={handleDetailChange} />
      </Suspense>
    </>
  );
}
