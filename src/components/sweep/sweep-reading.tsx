"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Quantity } from "@/components/ui/quantity";
import { spriteUrl } from "@/features/catalog/sprite";
import type { FenceDetection } from "@/features/sweep/types";

type Props = {
  detection: FenceDetection;
  fenceName: string | null;
  onOpen(id: number): void;
  onIntent(id: number): void;
  onRetry(): void;
};

const LIST_SPRITE_PX = 32;

// What the sweep found, in words and as a list: the same creatures as the markers, for keyboard and screen readers
export function SweepReading({ detection, fenceName, onOpen, onIntent, onRetry }: Props) {
  const t = useTranslations("Sweep");

  if (detection.status === "unavailable") {
    return (
      <Notice variant="error" title={t("unavailableTitle")} action={{ label: t("retry"), onActivate: onRetry }}>
        {t("unavailableBody")}
      </Notice>
    );
  }

  const traced = detection.status === "ready" ? detection.traced : [];
  // Named in the reading: two fences with the same counts would otherwise leave the live text unchanged
  const fence = fenceName ?? "";
  const reading =
    detection.status === "idle"
      ? t("hint")
      : detection.status === "loading"
        ? t("loading")
        : traced.length === 0
          ? t("empty", { fence })
          : t.rich("detected", {
              fence,
              count: traced.length,
              weak: detection.weakSignals,
              n: () => <Quantity value={traced.length} />,
              w: () => <Quantity value={detection.weakSignals} />,
            });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Live from the start, so the first reading is announced; a status once there is one to give.
          The hint before that is plain guidance, not news */}
      <p
        aria-live="polite"
        role={detection.status === "idle" ? undefined : "status"}
        className={`text-body ${detection.status === "idle" ? "text-muted" : "text-foreground"}`}
      >
        {reading}
      </p>
      {traced.length > 0 ? (
        <ul
          aria-label={t("list", { fence })}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0"
        >
          {traced.map(({ id, name }) => (
            <li key={id} className="shrink-0 md:*:w-full">
              <Button
                variant="secondary"
                aria-label={t("view", { name })}
                onClick={() => onOpen(id)}
                onMouseEnter={() => onIntent(id)}
                onFocus={() => onIntent(id)}
                className="w-full justify-start gap-1 py-0! pr-3! pl-1! *:inline-flex *:items-center *:gap-1"
              >
                {/* Decorative: the name is right beside it. next/image would proxy a 2 KB sprite for nothing */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={spriteUrl(id)}
                  alt=""
                  width={LIST_SPRITE_PX}
                  height={LIST_SPRITE_PX}
                  crossOrigin="anonymous"
                  decoding="async"
                  loading="lazy"
                  className="size-8 shrink-0"
                />
                {name}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
