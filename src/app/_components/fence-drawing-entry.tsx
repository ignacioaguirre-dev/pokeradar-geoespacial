"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";

// The mode, its rules and the territory it checks stay out of the initial JS; the panel arrives
// before the person can reach it, as it is preloaded once the map is idle
const load = () => import("./fence-drawing");

export const FenceDrawing = dynamic(() => load().then((m) => m.FenceDrawing), { ssr: false, loading: () => null });

export function preloadFenceDrawing(): void {
  void load();
}

const ICON = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 15 7 4l9 3-2 9z" strokeLinejoin="round" />
    <circle cx="4" cy="15" r="1.5" fill="currentColor" />
    <circle cx="7" cy="4" r="1.5" fill="currentColor" />
    <circle cx="16" cy="7" r="1.5" fill="currentColor" />
  </svg>
);

export function FenceDrawingTrigger({
  disabled,
  onStart,
  ref,
}: {
  disabled: boolean;
  onStart(): void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("FenceDrawing");
  return (
    <Button
      ref={ref}
      variant="secondary"
      disabled={disabled}
      onClick={onStart}
      // Same row and size as the presets it sits with
      className="w-full px-3! whitespace-nowrap md:justify-start"
    >
      <span className="flex items-center gap-2">
        {ICON}
        {t("start")}
      </span>
    </Button>
  );
}
