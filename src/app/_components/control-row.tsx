"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { ICON_MINUS, ICON_PLUS } from "./control-icons";
import { HabitatLegend } from "./habitat-legend";
import { type HelpLine, MapHelpButton, type MapHelpButtonHandle } from "./map-help";

type Props = {
  disabled: boolean;
  onZoomIn(): void;
  onZoomOut(): void;
  onReset(): void;
  // Read when the help opens, so what the map detects mid-gesture does not re-render anything
  helpLines(): readonly HelpLine[];
  // Where the help panel opens along the row
  helpPanelClassName: string;
  helpRef?: Ref<MapHelpButtonHandle>;
};

// Desktop: legend and help left, controls right, the same order on screen and for the keyboard.
// The help rides in the legend's row: both explain the map, the nav moves it
export function ControlRow({ disabled, onZoomIn, onZoomOut, onReset, helpLines, helpPanelClassName, helpRef }: Props) {
  const t = useTranslations("Map");
  return (
    <>
      <div className="flex gap-2">
        <HabitatLegend disabled={disabled} />
        <MapHelpButton ref={helpRef} panelClassName={helpPanelClassName} lines={helpLines} disabled={disabled} />
      </div>
      <nav aria-label={t("controls")} className="pointer-events-auto relative ml-auto flex shrink-0 gap-2">
        <Button variant="secondary" aria-label={t("zoomIn")} disabled={disabled} onClick={onZoomIn} className="px-0!">
          {ICON_PLUS}
        </Button>
        <Button variant="secondary" aria-label={t("zoomOut")} disabled={disabled} onClick={onZoomOut} className="px-0!">
          {ICON_MINUS}
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={onReset}>
          {t("reset")}
        </Button>
      </nav>
    </>
  );
}
