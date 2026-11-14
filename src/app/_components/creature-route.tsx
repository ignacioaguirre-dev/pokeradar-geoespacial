"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { closeCreature, CREATURE_PARAM, parseCreatureId } from "@/features/creature/history";

// motion and the panel stay out of the initial JS: the chunk is fetched the first time a creature opens
const DetailPanel = dynamic(() => import("./detail-panel").then((m) => m.DetailPanel), {
  ssr: false,
  loading: () => null,
});

type Props = {
  wide: boolean;
  fallbackFocus(): HTMLElement | null;
  // Whether a creature is open, for what shares the screen with the panel
  onOpenChange?(open: boolean): void;
};

// The URL is the panel's state: a shared ?creature= link opens it, and back (popstate) closes it
export function CreatureRoute({ wide, fallbackFocus, onOpenChange }: Props) {
  const params = useSearchParams();
  const id = parseCreatureId(params.get(CREATURE_PARAM));
  const open = id !== null;
  const reportOpen = useEffectEvent((value: boolean) => onOpenChange?.(value));
  useEffect(() => reportOpen(open), [open]);
  // Once opened the panel stays mounted, so closing can play its exit
  const [opened, setOpened] = useState(false);
  if (id !== null && !opened) setOpened(true);
  if (!opened && id === null) return null;
  return <DetailPanel id={id} wide={wide} onClose={closeCreature} fallbackFocus={fallbackFocus} />;
}
