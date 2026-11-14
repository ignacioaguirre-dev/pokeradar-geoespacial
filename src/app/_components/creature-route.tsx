"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { closeCreature, CREATURE_PARAM, parseCreatureId } from "@/features/creature/history";

const loadPanel = () => import("./detail-panel");

// motion and the panel stay out of the initial JS: the chunk is fetched the first time a creature opens
const DetailPanel = dynamic(() => loadPanel().then((m) => m.DetailPanel), {
  ssr: false,
  loading: () => null,
});

// On intent (hover, focus) or when the browser is idle: the chunk is ready before the first tap
export function preloadCreaturePanel(): void {
  void loadPanel();
}

type Props = {
  wide: boolean;
  fallbackFocus(): HTMLElement | null;
  // The creature in the URL, so the map can fly to it and what shares the screen makes room; null once it closes
  onChange?(id: number | null): void;
};

// The URL is the panel's state: a shared ?creature= link opens it, and back (popstate) closes it
export function CreatureRoute({ wide, fallbackFocus, onChange }: Props) {
  const params = useSearchParams();
  const id = parseCreatureId(params.get(CREATURE_PARAM));
  const report = useEffectEvent((current: number | null) => onChange?.(current));
  useEffect(() => report(id), [id]);
  // Once opened the panel stays mounted, so closing can play its exit
  const [opened, setOpened] = useState(false);
  if (id !== null && !opened) setOpened(true);
  if (!opened && id === null) return null;
  return <DetailPanel id={id} wide={wide} onClose={closeCreature} fallbackFocus={fallbackFocus} />;
}
