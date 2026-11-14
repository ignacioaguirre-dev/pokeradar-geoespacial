"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { type ReactNode, type Ref, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/ui/mark";
import { ICON_MINUS, ICON_PLUS } from "./control-icons";
import { HabitatSwatches } from "./habitat-legend";
import { type HelpLine, HelpLines } from "./map-help";

// motion comes in its own chunk, as with the detail: fetched on the first open
const SheetPanel = dynamic(() => import("@/components/ui/sheet").then((m) => m.Sheet), {
  ssr: false,
  loading: () => null,
});

// Ver Argentina: an eye with the flag at its lower right, the whole country back in view.
// A surface edge keeps the flag apart from the eye's stroke
const ICON_COUNTRY = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M1.5 9.5S4.5 4 10 4s8.5 5.5 8.5 5.5S15.5 15 10 15 1.5 9.5 1.5 9.5Z" strokeLinejoin="round" />
    <circle cx="10" cy="9.5" r="2.5" />
    <g stroke="none">
      <rect x="11.5" y="13" width="12" height="9" className="fill-surface" />
      <rect x="12.5" y="14" width="10" height="7" className="fill-flag-sky" />
      <rect x="12.5" y="16.33" width="10" height="2.34" className="fill-foreground" />
    </g>
  </svg>
);

// Hábitats: stacked layers, the habitat layer under the map
const ICON_LAYERS = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M10 2.5 18 7l-8 4.5L2 7l8-4.5Z" strokeLinejoin="round" />
    <path d="m2 10.5 8 4.5 8-4.5M2 14l8 4.5 8-4.5" strokeLinejoin="round" />
  </svg>
);

type Sheet = "help" | "habitats";

type Props = {
  disabled: boolean;
  onZoomIn(): void;
  onZoomOut(): void;
  onReset(): void;
  // Read when the help opens, so what the map detects mid-gesture does not re-render anything
  helpLines(): readonly HelpLine[];
  // The first-visit help, anchored beside the info mark
  intro?: ReactNode;
  ref?: Ref<HTMLElement>;
};

// Phones only: one column of icon buttons at the right edge. The zoom and the country act on the map at once;
// the info mark and the layers open a sheet from the bottom. The column leaves while the creature detail is up
// or the viewport widens, and its open sheet with it
export function ControlColumn({ disabled, onZoomIn, onZoomOut, onReset, helpLines, intro, ref }: Props) {
  const t = useTranslations("Map");
  const tHelp = useTranslations("MapHelp");
  const [open, setOpen] = useState<Sheet | null>(null);
  const [lines, setLines] = useState<readonly HelpLine[]>([]);
  // Mounted from the first open on, so closing can play its exit
  const [used, setUsed] = useState(false);
  // Button does not forward refs: these wrappers are how focus gets back to it
  const helpRef = useRef<HTMLSpanElement>(null);
  const layersRef = useRef<HTMLSpanElement>(null);

  function show(sheet: Sheet) {
    if (sheet === "help") setLines(helpLines());
    setOpen(sheet);
    setUsed(true);
  }

  function close() {
    setOpen(null);
  }

  const closeButton = (
    <Button variant="secondary" onClick={close}>
      {tHelp("close")}
    </Button>
  );

  return (
    <>
      <nav ref={ref} aria-label={t("controls")} className="controls-in pointer-events-auto flex flex-col gap-2 [--control-in-x:0.5rem] [--control-in-y:0]">
        <Button variant="secondary" aria-label={t("zoomIn")} disabled={disabled} onClick={onZoomIn} className="px-0!">
          {ICON_PLUS}
        </Button>
        <Button variant="secondary" aria-label={t("zoomOut")} disabled={disabled} onClick={onZoomOut} className="px-0!">
          {ICON_MINUS}
        </Button>
        <div className="relative">
          <span ref={helpRef} className="contents">
            <Button
              variant="secondary"
              aria-label={tHelp("title")}
              aria-haspopup="dialog"
              aria-expanded={open === "help"}
              disabled={disabled}
              onClick={() => show("help")}
              className="px-0!"
            >
              <Mark variant="info" />
            </Button>
          </span>
          {intro ? (
            // Left of the column, centred on the mark it explains; never wider than the room the column leaves
            <div className="absolute top-1/2 right-full mr-2 w-[min(18rem,calc(100vw-5rem))] -translate-y-1/2">{intro}</div>
          ) : null}
        </div>
        <Button variant="secondary" aria-label={t("reset")} disabled={disabled} onClick={onReset} className="px-0!">
          {ICON_COUNTRY}
        </Button>
        <span ref={layersRef} className="contents">
          <Button
            variant="secondary"
            aria-label={t("legend")}
            aria-haspopup="dialog"
            aria-expanded={open === "habitats"}
            disabled={disabled}
            onClick={() => show("habitats")}
            className="px-0!"
          >
            {ICON_LAYERS}
          </Button>
        </span>
      </nav>
      {used ? (
        <>
          <SheetPanel
            open={open === "help"}
            title={tHelp("title")}
            close={closeButton}
            onClose={close}
            returnFocus={() => helpRef.current?.querySelector("button") ?? null}
          >
            <div className="text-muted">
              <HelpLines lines={lines} />
            </div>
          </SheetPanel>
          <SheetPanel
            open={open === "habitats"}
            title={t("legend")}
            close={closeButton}
            onClose={close}
            returnFocus={() => layersRef.current?.querySelector("button") ?? null}
          >
            <HabitatSwatches />
          </SheetPanel>
        </>
      ) : null}
    </>
  );
}
