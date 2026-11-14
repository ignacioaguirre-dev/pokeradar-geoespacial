"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  fences: readonly { id: string; name: string }[];
  active: string | null;
  onChoose(id: string): void;
};

// A row that scrolls sideways on phones, two columns in the desktop panel
export function FencePicker({ fences, active, onChoose }: Props) {
  const t = useTranslations("Sweep");
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-2">
      <p
        id={labelId}
        className="font-display font-stretch-condensed text-label font-bold tracking-wider text-muted uppercase"
      >
        {t("fences")}
      </p>
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
        {fences.map(({ id, name }) => {
          const pressed = id === active;
          return (
            <li key={id} className="shrink-0 snap-start md:*:w-full">
              <Button
                variant={pressed ? "primary" : "secondary"}
                aria-pressed={pressed}
                onClick={() => onChoose(id)}
                // One line in the phone row; in the narrow desktop columns a long name wraps instead of spilling
                className="w-full px-3! whitespace-nowrap md:justify-start md:py-1 md:text-left md:leading-tight md:whitespace-normal"
              >
                {name}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
