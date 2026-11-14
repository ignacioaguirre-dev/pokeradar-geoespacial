"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, type Ref, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { PointerKind } from "@/hooks/use-pointer-kind";
import type { MapInput } from "@/map/base-map";

export type HelpLine = "touch" | "touchpad" | "mouse" | "keyboard";

const DESKTOP: readonly HelpLine[] = ["touchpad", "mouse", "keyboard"];

// What the device says it has before anyone touches the map
export function introLines(pointer: PointerKind): HelpLine[] {
  if (pointer === "coarse") return ["touch"];
  if (pointer === "hybrid") return [...DESKTOP, "touch"];
  return [...DESKTOP];
}

// Every input, so a person on an unexpected device still finds theirs; what the map saw goes first
export function panelLines(pointer: PointerKind | null, detected: MapInput | null): HelpLine[] {
  const base: HelpLine[] = pointer === "coarse" ? ["touch", ...DESKTOP] : [...DESKTOP, "touch"];
  return detected ? [detected, ...base.filter((line) => line !== detected)] : base;
}

function Lines({ lines }: { lines: readonly HelpLine[] }) {
  const t = useTranslations("MapHelp");
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={line}>{t(line)}</li>
      ))}
    </ul>
  );
}

export function MapHelpIntro({ lines, onDismiss }: { lines: readonly HelpLine[]; onDismiss(): void }) {
  const t = useTranslations("MapHelp");
  return (
    <Notice variant="info" title={t("title")} action={{ label: t("dismiss"), onActivate: onDismiss }}>
      <Lines lines={lines} />
    </Notice>
  );
}

// Room kept above the panel for the brand, so a tall panel scrolls instead of running off the top
const TOP_CLEARANCE_PX = 64;

export type MapHelpButtonHandle = {
  focus(): void;
  // Closes the panel without moving the focus: the person is already busy with the map
  close(): void;
};

type MapHelpButtonProps = {
  // Read when the panel opens, so what the map detects mid-gesture does not re-render anything
  lines(): readonly HelpLine[];
  disabled?: boolean;
  // Where the panel opens along the row, for what else floats at its left edge
  panelClassName?: string;
  ref?: Ref<MapHelpButtonHandle>;
};

export function MapHelpButton({ lines, disabled = false, panelClassName = "left-0", ref }: MapHelpButtonProps) {
  const t = useTranslations("MapHelp");
  // The lines shown while open; null while closed
  const [shown, setShown] = useState<readonly HelpLine[] | null>(null);
  const open = shown !== null;
  // Button does not forward refs, so the trigger is reached through a wrapper of its own
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const headingId = useId();
  // Reset while rendering, so the help does not pop open again by itself once re-enabled
  if (disabled && open) setShown(null);

  function focusTrigger() {
    triggerRef.current?.querySelector("button")?.focus();
  }

  useImperativeHandle(ref, () => ({ focus: focusTrigger, close: () => setShown(null) }), []);

  // On a phone it opens above the whole sweep panel, which may leave less room than the lines need
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.maxHeight = "";
    const { bottom, height } = panel.getBoundingClientRect();
    const room = bottom - TOP_CLEARANCE_PX;
    if (height > room) panel.style.maxHeight = `${Math.max(room, 0)}px`;
  }, [shown]);

  function close() {
    setShown(null);
    focusTrigger();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    close();
  }

  return (
    // Not positioned: the panel anchors to what holds the controls row, so it never runs off a narrow screen
    <div className="pointer-events-auto" onKeyDown={handleKeyDown}>
      <span ref={triggerRef} className="contents">
        <Button
          variant="secondary"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          disabled={disabled}
          onClick={() => setShown(open ? null : lines())}
          className="px-0! md:px-4!"
        >
          {/* On phones only the info mark of the notices, so the row keeps room; the name stays for screen readers */}
          <span aria-hidden="true" className="font-mono text-subtitle font-bold md:hidden">
            i
          </span>
          <span className="max-md:sr-only">{t("title")}</span>
        </Button>
      </span>
      {/* After its button, so Tab goes from the button into the panel. It opens upward from the row's left edge,
          narrow enough (24rem) to stay clear of the creature detail on desktop */}
      {shown ? (
        <section
          ref={panelRef}
          id={panelId}
          aria-labelledby={headingId}
          className={`absolute bottom-full mb-2 flex overflow-y-auto ${panelClassName} w-max max-w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-panel border border-structure bg-surface p-3 text-body text-foreground`}
        >
          <h2 id={headingId} className="font-semibold">
            {t("title")}
          </h2>
          <div className="text-muted">
            <Lines lines={shown} />
          </div>
          <Button variant="secondary" onClick={close} className="self-end">
            {t("close")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
