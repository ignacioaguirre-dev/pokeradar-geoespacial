"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Notice } from "@/components/ui/notice";
import { useOnline } from "@/hooks/use-online";

// Shorter cuts flicker past without the user ever noticing them
const OFFLINE_DELAY_MS = 1_000;
const RECOVERED_MS = 3_000;

type Shown = "none" | "offline" | "recovered";

// Below the brand and clear of the detail (bottom sheet on phones, right panel from md); never takes clicks
const PLACEMENT =
  "pointer-events-none fixed inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3rem)] z-30 " +
  "px-[max(0.75rem,env(safe-area-inset-left))] md:top-[calc(max(0.75rem,env(safe-area-inset-top))+4.5rem)] " +
  "md:right-auto md:w-[calc(22rem+max(0.75rem,env(safe-area-inset-left)))]";

export function ConnectionStatus() {
  const t = useTranslations("Connection");
  const online = useOnline();
  const [shown, setShown] = useState<Shown>("none");

  // The recovery is told at once; adjusted while rendering so the offline text never lingers a frame
  if (online && shown === "offline") setShown("recovered");

  useEffect(() => {
    if (online) return;
    const timer = setTimeout(() => setShown("offline"), OFFLINE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [online]);

  useEffect(() => {
    if (shown !== "recovered") return;
    const timer = setTimeout(() => setShown("none"), RECOVERED_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  // The live region is always there, so a screen reader announces the text inserted into it
  return (
    <div role="status" aria-live="polite" className={PLACEMENT}>
      {shown === "none" ? null : (
        <div key={shown} className="motion-safe:animate-[notice-in_var(--duration-medium)_var(--curve-out)_both]">
          {shown === "offline" ? (
            <Notice variant="info" title={t("offlineTitle")} live={false}>
              {t("offlineBody")}
            </Notice>
          ) : (
            <Notice variant="success" title={t("recovered")} live={false} />
          )}
        </div>
      )}
    </div>
  );
}
