"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { closeCreature, CREATURE_PARAM, parseCreatureId } from "@/features/creature/history";
import { PANEL } from "./detail-panel-shell";
import { LoadBoundary, useLazyWhenOnline } from "./load-when-online";

// motion and the panel stay out of the initial JS: the chunk is fetched the first time a creature opens
const loadPanel = () => import("./detail-panel").then((m) => m.DetailPanel);

type Props = {
  wide: boolean;
  fallbackFocus(): HTMLElement | null;
  // Whether a creature is open, for what shares the screen with the panel
  onOpenChange?(open: boolean): void;
};

// The URL is the panel's state: a shared ?creature= link opens it, and back (popstate) closes it
export function CreatureRoute({ wide, fallbackFocus, onOpenChange }: Props) {
  const t = useTranslations("Creature");
  const params = useSearchParams();
  const [DetailPanel, reloadPanel] = useLazyWhenOnline(loadPanel);
  const [attempt, setAttempt] = useState(0);
  const id = parseCreatureId(params.get(CREATURE_PARAM));
  const open = id !== null;
  const reportOpen = useEffectEvent((value: boolean) => onOpenChange?.(value));
  useEffect(() => reportOpen(open), [open]);
  // Once opened the panel stays mounted, so closing can play its exit
  const [opened, setOpened] = useState(false);
  if (id !== null && !opened) setOpened(true);
  if (!opened && id === null) return null;

  function retry() {
    reloadPanel();
    setAttempt((a) => a + 1);
  }

  const failed =
    id === null ? null : (
      <section aria-label={t("region")} className={`${PANEL} gap-3`}>
        <Notice variant="error" title={t("errorTitle")} action={{ label: t("retry"), onActivate: retry }}>
          {t("errorBody")}
        </Notice>
        <Button variant="secondary" onClick={closeCreature} className="self-end">
          {t("close")}
        </Button>
      </section>
    );

  return (
    <LoadBoundary key={attempt} fallback={failed}>
      <DetailPanel id={id} wide={wide} onClose={closeCreature} fallbackFocus={fallbackFocus} />
    </LoadBoundary>
  );
}
