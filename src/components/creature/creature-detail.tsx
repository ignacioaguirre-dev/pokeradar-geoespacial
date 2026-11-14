"use client";

import { animate } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { EnergyBar } from "@/components/ui/energy-bar";
import { Notice } from "@/components/ui/notice";
import { Quantity } from "@/components/ui/quantity";
import { Tag } from "@/components/ui/tag";
import type { CreatureDetail as Detail } from "@/features/catalog/types";
import type { CreatureError } from "@/features/creature/use-creature";
import { useDurationToken } from "@/hooks/use-duration-token";

type Props = {
  state: "loading" | "error" | "ready";
  data?: Detail;
  error?: CreatureError;
  onRetry(): void;
  onClose(): void;
  titleRef?: Ref<HTMLHeadingElement>;
};

// Base stats top out at 255 across every species
const STAT_MAX = 255;
const STATS = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
// --curve-out from globals.css, as motion takes it
const CURVE_OUT = [0.16, 1, 0.3, 1] as const;

const SKELETON = "rounded-control bg-structure motion-safe:animate-pulse";
const LINK =
  "inline-flex min-h-11 items-center rounded-control underline underline-offset-2 hover:text-foreground " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

const noSubscription = () => () => {};
// Cries are Ogg Vorbis; older Safari cannot play them, so the button would do nothing there
function canPlayOgg(): boolean {
  return document.createElement("audio").canPlayType("audio/ogg") !== "";
}

// The value climbs from 0 so the bar grows in; with reduced motion the token is 0 and it lands at once
function GrowingEnergyBar({ label, value }: { label: string; value: number }) {
  const durationMs = useDurationToken("--duration-medium");
  const [shown, setShown] = useState(durationMs === 0 ? value : 0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: durationMs / 1000,
      ease: CURVE_OUT,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, durationMs]);
  return <EnergyBar label={label} value={shown} max={STAT_MAX} />;
}

function CryButton({ src }: { src: string }) {
  const t = useTranslations("Creature");
  const supported = useSyncExternalStore(noSubscription, canPlayOgg, () => false);
  const audio = useRef<HTMLAudioElement | null>(null);
  if (!supported) return null;
  return (
    <Button
      variant="secondary"
      onClick={() => {
        // Created on the tap itself: never autoplays, and a second tap restarts instead of overlapping
        audio.current?.pause();
        audio.current = new Audio(src);
        audio.current.play().catch(() => {});
      }}
    >
      {t("cry")}
    </Button>
  );
}

function Sprite({ sprite, name }: { sprite: Detail["sprite"]; name: string }) {
  const img = (
    // next/image would proxy and resize pixel art; the sprites are tiny and must stay pixelated
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sprite.animated ?? sprite.still}
      alt={name}
      width={96}
      height={96}
      className="size-24 object-contain [image-rendering:pixelated]"
    />
  );
  if (!sprite.animated) return img;
  // The browser picks the still frame itself, so no script decides and nothing flickers
  return (
    <picture className="shrink-0">
      <source media="(prefers-reduced-motion: reduce)" srcSet={sprite.still} />
      {img}
    </picture>
  );
}

export function CreatureDetail({ state, data, error, onRetry, onClose, titleRef }: Props) {
  const t = useTranslations("Creature");
  const tStats = useTranslations("Stats");
  const tTypes = useTranslations("Types");
  const statsId = useId();
  const ready = state === "ready" && data !== undefined;

  return (
    <article className="flex flex-col gap-4">
      {/* The name gets the panel's full width: next to the button, longer names broke mid-word.
          The heading stays first in reading order; only the row of number and Close is drawn above it */}
      <header className="flex flex-col gap-1">
        <h2
          ref={titleRef}
          tabIndex={-1}
          className="order-last self-start font-display font-stretch-condensed text-headline font-extrabold uppercase wrap-break-word rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {ready ? (
            data.name
          ) : (
            <>
              <span className="sr-only">{t("region")}</span>
              {state === "loading" ? <span aria-hidden="true" className={`block h-lh w-40 ${SKELETON}`} /> : null}
            </>
          )}
        </h2>
        <div className="flex items-center justify-between gap-3">
          {ready ? (
            <data value={data.id} className="font-mono text-body text-muted tabular-nums">
              #{String(data.id).padStart(3, "0")}
            </data>
          ) : state === "loading" ? (
            <span aria-hidden="true" className={`block h-lh w-12 text-body ${SKELETON}`} />
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </header>

      {state === "error" ? (
        error === "not-found" ? (
          <Notice variant="error" title={t("notFoundTitle")} />
        ) : (
          <Notice variant="error" title={t("errorTitle")} action={{ label: t("retry"), onActivate: onRetry }}>
            {t("errorBody")}
          </Notice>
        )
      ) : (
        <>
          <div className="flex gap-4">
            {ready ? (
              <Sprite sprite={data.sprite} name={data.name} />
            ) : (
              <span aria-hidden="true" className={`size-24 shrink-0 ${SKELETON}`} />
            )}
            <div className="flex min-w-0 flex-col gap-3">
              {ready ? (
                <ul aria-label={t("types")} className="flex flex-wrap gap-x-3 gap-y-1">
                  {data.types.map((type) => (
                    <li key={type}>
                      <Tag variant="neutral">{tTypes(type)}</Tag>
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status" className="text-label text-muted">
                  {t("loading")}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(
                  [
                    ["height", data?.heightM, "m"],
                    ["weight", data?.weightKg, "kg"],
                  ] as const
                ).map(([key, value, unit]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <dt className="font-display font-stretch-condensed text-label font-bold uppercase tracking-wider text-muted">
                      {t(key)}
                    </dt>
                    <dd className="text-body">
                      {value === undefined ? (
                        <span aria-hidden="true" className={`block h-lh w-14 ${SKELETON}`} />
                      ) : (
                        <Quantity value={value} decimals={1} unit={unit} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {ready && data.flavor ? <p className="max-w-prose text-body">{data.flavor}</p> : null}

          {/* A plain block, not a nested section: a region inside the panel region crashes Firefox under axe */}
          <div className="flex flex-col gap-3">
            <h3
              id={statsId}
              className="font-display font-stretch-condensed text-label font-bold uppercase tracking-wider text-muted"
            >
              {t("stats")}
            </h3>
            <ul aria-labelledby={statsId} className="flex flex-col gap-3">
              {STATS.map((stat) => (
                <li key={stat}>
                  {ready ? (
                    <GrowingEnergyBar label={tStats(stat)} value={data.stats[stat]} />
                  ) : (
                    // Same rows as EnergyBar: a label line and the 0.5 rem bar
                    <div aria-hidden="true" className="flex flex-col gap-1 text-label">
                      <span className={`block h-lh w-24 ${SKELETON}`} />
                      <span className={`block h-2 w-full ${SKELETON}`} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {ready && data.cry ? <CryButton src={data.cry} /> : null}
        </>
      )}

      <footer className="text-label text-muted">
        <a href="https://pokeapi.co" className={LINK}>
          {t("attribution")}
        </a>
      </footer>
    </article>
  );
}
