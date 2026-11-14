"use client";

import { animate } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { useDurationToken } from "@/hooks/use-duration-token";
import { CURVE_OUT } from "./motion-tokens";

type Props = {
  id: string;
  value: number;
  max: number;
  // Position among its siblings: each bar starts a beat after the one above
  order?: number;
};

const STAGGER_S = 0.06;

// A meter that fills from zero to its value when it appears. Rendered with its real value, so without script or
// under reduced motion (the token is 0) it is simply drawn full; the fill only plays over it
export function GrowingMeter({ id, value, max, order = 0 }: Props) {
  const ref = useRef<HTMLMeterElement>(null);
  const durationMs = useDurationToken("--duration-sweep");

  // Before paint, so the full bar never flashes ahead of the fill
  useLayoutEffect(() => {
    const meter = ref.current;
    if (!meter || durationMs === 0) return;
    meter.value = 0;
    const fill = animate(0, value, {
      duration: durationMs / 1000,
      delay: order * STAGGER_S,
      ease: CURVE_OUT,
      onUpdate: (current) => {
        meter.value = current;
      },
    });
    return () => {
      fill.stop();
      meter.value = value;
    };
  }, [value, durationMs, order]);

  return <meter ref={ref} id={id} className="energy-meter" min={0} max={max} value={value} />;
}
