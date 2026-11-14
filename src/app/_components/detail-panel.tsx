"use client";

import { AnimatePresence, domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { CreatureDetail } from "@/components/creature/creature-detail";
import { CURVE_OUT } from "@/components/ui/motion-tokens";
import { useCreature } from "@/features/creature/use-creature";
import { useDurationToken } from "@/hooks/use-duration-token";

type Props = {
  id: number | null;
  wide: boolean;
  onClose(): void;
  // Where focus lands on close when nothing outside the panel had it (a shared link opens it on load)
  fallbackFocus(): HTMLElement | null;
};

// Not modal: the map stays usable around it. A bottom sheet up to 60 % tall on phones, a floating panel on desktop.
// On phones it rests on the legend row and the map controls (two rows of 44 px), which rest on the attribution
// (two lines of 44 px), 8 px apart: the controls stay in reach and the attribution visible. It never climbs higher
// than 10rem from the top, so the creature it is about keeps some map above it
const PANEL =
  "pointer-events-auto fixed inset-x-0 bottom-[calc(12.5rem+env(safe-area-inset-bottom))] z-20 flex " +
  "max-h-[min(60dvh,calc(100dvh-22.5rem-env(safe-area-inset-bottom)))] " +
  "flex-col overflow-y-auto overscroll-contain rounded-t-panel border-t border-structure bg-surface p-4 " +
  "md:inset-x-auto md:top-3 md:right-[max(0.75rem,env(safe-area-inset-right))] md:bottom-auto md:w-[360px] " +
  "md:max-h-[calc(100dvh-10rem)] md:rounded-panel md:border md:pb-4";

export function DetailPanel({ id, wide, onClose, fallbackFocus }: Props) {
  const t = useTranslations("Creature");
  const creature = useCreature(id);
  const durationMs = useDurationToken("--duration-medium");
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  // Closing goes back in history and the id only changes on popstate: until then, ask once
  const closing = useRef(false);
  const open = id !== null;

  useEffect(() => {
    closing.current = false;
  }, [id]);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  };

  const enter = useEffectEvent(() => {
    const active = document.activeElement;
    origin.current = active instanceof HTMLElement && active !== document.body ? active : null;
    titleRef.current?.focus({ preventScroll: true });
  });

  const leave = useEffectEvent(() => {
    const active = document.activeElement;
    // Only pull focus back when it was in the panel (or lost); a click on the map keeps it there
    const lost = active === null || active === document.body || panelRef.current?.contains(active);
    if (!lost) return;
    const target = origin.current?.isConnected ? origin.current : fallbackFocus();
    target?.focus({ preventScroll: true });
    origin.current = null;
  });

  const escape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) close();
  });

  useEffect(() => {
    if (!open) return;
    enter();
    const onKeyDown = (event: KeyboardEvent) => escape(event);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      leave();
    };
  }, [open]);

  // With reduced motion the token is 0: no travel, the panel just appears
  const offset = durationMs === 0 ? 0 : "100%";
  const hidden = wide ? { x: offset } : { y: offset };
  const name = creature.state === "ready" ? creature.data?.name : undefined;

  return (
    // domAnimation with m.* instead of the full motion bundle: the panel only animates x and y
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && creature.state !== "idle" ? (
          <m.section
            key="detail"
            ref={panelRef}
            aria-label={name ?? t("region")}
            className={PANEL}
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ duration: durationMs / 1000, ease: CURVE_OUT }}
          >
            <CreatureDetail
              state={creature.state}
              data={creature.data}
              error={creature.error}
              onRetry={creature.retry}
              onClose={close}
              titleRef={titleRef}
            />
          </m.section>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
